import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { App } from 'supertest/types';
import { In, Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { User, UserRole } from './../src/users/entities/user.entity';
import { PrismaService } from './../src/prisma/prisma.service';
import type { SongWithArtists } from './../src/prisma-songs/prisma-songs.service';

// /prisma/songs — the Prisma rebuild of /songs (Project 9) — against the
// real Postgres from `.env`, in Prisma's own "prisma" schema. Users still
// live in TypeORM's "public" (auth is unchanged), so setup and cleanup
// touch both: songs/artists through PrismaService, users through the
// TypeORM repository. Everything is keyed by `stamp`.
jest.setTimeout(15_000);

describe('Prisma songs (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  let prisma: PrismaService;

  const stamp = Date.now();
  const password = 'password123';
  const userEmail = `e2e-${stamp}-prisma-user@example.com`;
  const adminEmail = `e2e-${stamp}-prisma-admin@example.com`;
  const title = `E2E Prisma Song ${stamp}`;
  const artist = (n: number) => `E2E Prisma Artist ${stamp} ${n}`;

  let userToken: string;
  let adminToken: string;

  const http = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${adminToken}`);

  const body = {
    title,
    artists: [artist(1), artist(2)],
    releaseDate: '2024-01-15',
    duration: '03:45',
  };

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return (res.body as { access_token: string }).access_token;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0);

    users = app.get(getRepositoryToken(User));
    prisma = app.get(PrismaService);

    for (const email of [userEmail, adminEmail]) {
      await http().post('/auth/signup').send({ email, password }).expect(201);
    }
    await users.update({ email: adminEmail }, { role: UserRole.ADMIN });

    userToken = await login(userEmail);
    adminToken = await login(adminEmail);
  });

  afterAll(async () => {
    // Songs first: deleting them removes their _ArtistToSong links
    // (cascading FKs), after which the artists can go.
    await prisma.song.deleteMany({ where: { title: { startsWith: title } } });
    await prisma.artist.deleteMany({
      where: { name: { startsWith: `E2E Prisma Artist ${stamp}` } },
    });
    await users.delete({ email: In([userEmail, adminEmail]) });
    await app.close();
  });

  it('requires a token to create a song', async () => {
    await http().post('/prisma/songs').send(body).expect(401);
  });

  it('forbids a non-admin from creating a song', async () => {
    await http()
      .post('/prisma/songs')
      .set('Authorization', `Bearer ${userToken}`)
      .send(body)
      .expect(403);
  });

  it('validates the create body', async () => {
    await asAdmin(http().post('/prisma/songs'))
      .send({ ...body, duration: 'banana' })
      .expect(400);
  });

  describe('an admin-created song', () => {
    let id: number;

    beforeAll(async () => {
      const res = await asAdmin(http().post('/prisma/songs'))
        .send(body)
        .expect(201);
      const song = res.body as SongWithArtists;
      id = song.id;

      expect(song).toMatchObject({ title, duration: '03:45' });
      expect(song.artists.map((a) => a.name).sort()).toEqual([
        artist(1),
        artist(2),
      ]);
    });

    it('is publicly readable, artists included', async () => {
      const res = await http().get(`/prisma/songs/${id}`).expect(200);

      expect((res.body as SongWithArtists).artists).toHaveLength(2);
    });

    it('is stored in the "prisma" schema, not TypeORM\'s "public"', async () => {
      // Raw SQL must name the schema: the adapter qualifies Prisma's own
      // queries, but the connection's search_path is still "public".
      const rows = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM prisma.songs WHERE id = ${id}`;

      expect(rows).toEqual([{ id }]);
    });

    it('appears in the paginated list, with a total', async () => {
      const res = await http().get('/prisma/songs?page=1&limit=1').expect(200);
      const page = res.body as { data: SongWithArtists[]; total: number };

      expect(page.data).toHaveLength(1);
      expect(page.total).toBe(await prisma.song.count());
    });

    it('updates only the supplied fields', async () => {
      const res = await asAdmin(http().put(`/prisma/songs/${id}`))
        .send({ duration: '04:00' })
        .expect(200);
      const song = res.body as SongWithArtists;

      expect(song).toMatchObject({ id, title, duration: '04:00' });
      expect(song.artists).toHaveLength(2);
    });

    it('replaces the artists rather than adding to them', async () => {
      const res = await asAdmin(http().put(`/prisma/songs/${id}`))
        .send({ artists: [artist(2), artist(3)] })
        .expect(200);

      expect(
        (res.body as SongWithArtists).artists.map((a) => a.name).sort(),
      ).toEqual([artist(2), artist(3)]);
    });

    it('rejects an invalid update body', async () => {
      const res = await asAdmin(http().put(`/prisma/songs/${id}`))
        .send({ duration: 'banana' })
        .expect(400);

      // The rule that failed, not just any 400 (a bad id is one too).
      expect(String((res.body as { message: unknown }).message)).toContain(
        'duration',
      );
    });

    it('can be deleted, after which it is gone', async () => {
      await asAdmin(http().delete(`/prisma/songs/${id}`)).expect(204);
      await http().get(`/prisma/songs/${id}`).expect(404);
    });
  });

  describe('a missing song', () => {
    it('is a 404 to read', async () => {
      await http().get('/prisma/songs/999999').expect(404);
    });

    it('is a 404 to update (P2025 translated, not a 500)', async () => {
      await asAdmin(http().put('/prisma/songs/999999'))
        .send({ duration: '04:00' })
        .expect(404);
    });

    it('is a 404 to delete (P2025 translated, not a 500)', async () => {
      await asAdmin(http().delete('/prisma/songs/999999')).expect(404);
    });

    it('is a 400 for a non-numeric id', async () => {
      await http().get('/prisma/songs/abc').expect(400);
    });
  });
});
