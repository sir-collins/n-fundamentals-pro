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
import { Prisma } from './../src/generated/prisma/client';
import type { Album, Lyrics } from './../src/generated/prisma/client';
import { PrismaService } from './../src/prisma/prisma.service';
import type { SongWithArtists } from './../src/prisma-songs/prisma-songs.service';
import type { ArtistDetail } from './../src/prisma-relations/prisma-relations.service';

// The two relation types added in Project 9 — Artist → Albums
// (one-to-many) and Song → Lyrics (one-to-one) — against the real
// Postgres, plus what each foreign key does on delete. Setup mirrors
// prisma.e2e-spec.ts: users in TypeORM's "public", the rest in "prisma",
// everything keyed by `stamp`.
jest.setTimeout(15_000);

describe('Prisma relations (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  let prisma: PrismaService;

  const stamp = Date.now();
  const password = 'password123';
  const userEmail = `e2e-${stamp}-relations-user@example.com`;
  const adminEmail = `e2e-${stamp}-relations-admin@example.com`;
  const title = `E2E Relations Song ${stamp}`;
  const artistName = `E2E Relations Artist ${stamp}`;
  const albumTitle = (n: number) => `E2E Relations Album ${stamp} ${n}`;

  let userToken: string;
  let adminToken: string;
  let songId: number;
  let artistId: number;

  const http = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${adminToken}`);

  const album = (n: number) => ({
    title: albumTitle(n),
    releaseDate: '2020-03-20',
  });

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

    // A song with one artist, through the existing API: its response
    // carries the artist's id, which the album routes need.
    const res = await asAdmin(http().post('/prisma/songs'))
      .send({
        title,
        artists: [artistName],
        releaseDate: '2024-01-15',
        duration: '03:45',
      })
      .expect(201);
    const song = res.body as SongWithArtists;
    songId = song.id;
    artistId = song.artists[0].id;
  });

  afterAll(async () => {
    // Order matters: songs first (their lyrics cascade with them), then
    // albums (Restrict blocks deleting an artist who still has some),
    // then artists.
    await prisma.song.deleteMany({ where: { title: { startsWith: title } } });
    await prisma.album.deleteMany({
      where: { title: { startsWith: `E2E Relations Album ${stamp}` } },
    });
    await prisma.artist.deleteMany({ where: { name: artistName } });
    await users.delete({ email: In([userEmail, adminEmail]) });
    await app.close();
  });

  describe('Artist → Albums (one-to-many)', () => {
    it('requires a token to add an album', async () => {
      await http()
        .post(`/prisma/artists/${artistId}/albums`)
        .send(album(1))
        .expect(401);
    });

    it('forbids a non-admin from adding an album', async () => {
      await http()
        .post(`/prisma/artists/${artistId}/albums`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(album(1))
        .expect(403);
    });

    it('validates the album body', async () => {
      const res = await asAdmin(
        http().post(`/prisma/artists/${artistId}/albums`),
      )
        .send({ ...album(1), releaseDate: 'banana' })
        .expect(400);

      expect(String((res.body as { message: unknown }).message)).toContain(
        'releaseDate',
      );
    });

    it('adds albums under the artist, returned with a song count', async () => {
      for (const n of [1, 2]) {
        const res = await asAdmin(
          http().post(`/prisma/artists/${artistId}/albums`),
        )
          .send(album(n))
          .expect(201);

        expect(res.body as Album).toMatchObject({ ...album(n), artistId });
      }

      const res = await http().get(`/prisma/artists/${artistId}`).expect(200);
      const artist = res.body as ArtistDetail;

      expect(artist.name).toBe(artistName);
      expect(artist.albums.map((a) => a.title)).toEqual([
        albumTitle(1),
        albumTitle(2),
      ]);
      expect(artist._count.songs).toBe(1);
    });

    it('is a 404 to add an album to a missing artist (not a 500)', async () => {
      await asAdmin(http().post('/prisma/artists/999999/albums'))
        .send(album(1))
        .expect(404);
    });

    it('is a 404 to read a missing artist', async () => {
      await http().get('/prisma/artists/999999').expect(404);
    });
  });

  describe('Song → Lyrics (one-to-one)', () => {
    it('is a 404 before any lyrics are set', async () => {
      await http().get(`/prisma/songs/${songId}/lyrics`).expect(404);
    });

    it('forbids a non-admin from setting lyrics', async () => {
      await http()
        .put(`/prisma/songs/${songId}/lyrics`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ text: 'first' })
        .expect(403);
    });

    it('creates the lyrics, then replaces them — still one row', async () => {
      const first = await asAdmin(http().put(`/prisma/songs/${songId}/lyrics`))
        .send({ text: 'first' })
        .expect(200);
      const second = await asAdmin(http().put(`/prisma/songs/${songId}/lyrics`))
        .send({ text: 'second' })
        .expect(200);

      // Same row updated in place, not a second one inserted.
      expect((second.body as Lyrics).id).toBe((first.body as Lyrics).id);
      expect(await prisma.lyrics.count({ where: { songId } })).toBe(1);

      const res = await http()
        .get(`/prisma/songs/${songId}/lyrics`)
        .expect(200);
      expect(res.body as Lyrics).toMatchObject({ songId, text: 'second' });
    });

    it('is a 404 to set lyrics on a missing song (not a 500)', async () => {
      await asAdmin(http().put('/prisma/songs/999999/lyrics'))
        .send({ text: 'x' })
        .expect(404);
    });

    it('enforces one lyrics row per song in the database itself', async () => {
      // Bypassing upsert: a second insert for the same song breaks the
      // unique index on songId (P2002).
      await expect(
        prisma.lyrics.create({ data: { text: 'dup', songId } }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('on delete', () => {
    it("won't delete an artist who still has albums (Restrict)", async () => {
      const attempt = prisma.artist.delete({ where: { id: artistId } });

      await expect(attempt).rejects.toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError,
      );
      await expect(attempt).rejects.toMatchObject({ code: 'P2003' });
      expect(await prisma.artist.count({ where: { id: artistId } })).toBe(1);
    });

    it("deletes a song's lyrics along with the song (Cascade)", async () => {
      await asAdmin(http().delete(`/prisma/songs/${songId}`)).expect(204);

      expect(await prisma.lyrics.count({ where: { songId } })).toBe(0);
    });
  });
});
