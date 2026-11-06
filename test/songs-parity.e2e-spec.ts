import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { App } from 'supertest/types';
import { In, Like, Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { User, UserRole } from './../src/users/entities/user.entity';
import { Song } from './../src/songs/entities/song.entity';
import { Artist } from './../src/artists/entities/artist.entity';
import { PrismaService } from './../src/prisma/prisma.service';

// Project 9's closing check: `/prisma/songs` has been called a mirror of
// `/songs` since sub-step 2, and this suite holds it to that. The same
// scenarios run against both routes (describe.each), then a few compare
// the two responses directly. Both run against the real Postgres — songs
// in TypeORM's "public" schema and Prisma's "prisma" schema respectively.
//
// The mass-assignment tests only ever aim at songs this suite created:
// before the global `whitelist: true`, a stray `id` in a body really did
// reach the database.
jest.setTimeout(20_000);

type SongBody = {
  id: number;
  title: string;
  releaseDate: string;
  duration: string;
  artists: { id: number; name: string }[];
};

describe('Songs parity: TypeORM vs Prisma (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  let prisma: PrismaService;

  const stamp = Date.now();
  const password = 'password123';
  const userEmail = `e2e-${stamp}-parity-user@example.com`;
  const adminEmail = `e2e-${stamp}-parity-admin@example.com`;
  const songPrefix = `E2E Parity Song ${stamp}`;
  const artistPrefix = `E2E Parity Artist ${stamp}`;
  const song = (name: string, artists: string[] = ['one']) => ({
    title: `${songPrefix} ${name}`,
    artists: artists.map((a) => `${artistPrefix} ${a}`),
    releaseDate: '2024-01-15',
    duration: '03:45',
  });

  let userToken: string;
  let adminToken: string;

  const http = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${adminToken}`);
  const message = (res: request.Response) =>
    (res.body as { message: unknown }).message;

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return (res.body as { access_token: string }).access_token;
  }

  async function create(base: string, body: object): Promise<SongBody> {
    const res = await asAdmin(http().post(base)).send(body).expect(201);
    return res.body as SongBody;
  }

  /** A song as the API returns it, ids removed — comparable across ORMs. */
  const withoutIds = (song: SongBody) => ({
    title: song.title,
    releaseDate: song.releaseDate,
    duration: song.duration,
    artists: song.artists.map((a) => a.name).sort(),
  });

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
    // TypeORM side: songs (their join rows go with them), then artists.
    await app
      .get<Repository<Song>>(getRepositoryToken(Song))
      .delete({ title: Like(`${songPrefix}%`) });
    await app
      .get<Repository<Artist>>(getRepositoryToken(Artist))
      .delete({ name: Like(`${artistPrefix}%`) });
    // Prisma side: same, in its own schema.
    await prisma.song.deleteMany({
      where: { title: { startsWith: songPrefix } },
    });
    await prisma.artist.deleteMany({
      where: { name: { startsWith: artistPrefix } },
    });
    await users.delete({ email: In([userEmail, adminEmail]) });
    await app.close();
  });

  describe.each(['/songs', '/prisma/songs'])('%s', (base) => {
    it('requires a token, then an admin, to create', async () => {
      await http().post(base).send(song('auth')).expect(401);
      await http()
        .post(base)
        .set('Authorization', `Bearer ${userToken}`)
        .send(song('auth'))
        .expect(403);
    });

    it('creates a song with exactly the documented fields', async () => {
      const created = await create(base, song('shape', ['one', 'two']));

      expect(Object.keys(created).sort()).toEqual(
        ['artists', 'duration', 'id', 'releaseDate', 'title'].sort(),
      );
      expect(Object.keys(created.artists[0]).sort()).toEqual(['id', 'name']);
    });

    it('lists a page and a total', async () => {
      const res = await http().get(`${base}?page=1&limit=2`).expect(200);
      const { data, total } = res.body as { data: SongBody[]; total: number };

      expect(data.length).toBeLessThanOrEqual(2);
      expect(total).toBeGreaterThanOrEqual(data.length);
    });

    it('updates only the supplied fields, replacing artists', async () => {
      const created = await create(base, song('update', ['one', 'two']));

      const res = await asAdmin(http().put(`${base}/${created.id}`))
        .send({ duration: '04:00', artists: [`${artistPrefix} three`] })
        .expect(200);
      const updated = res.body as SongBody;

      expect(updated).toMatchObject({
        id: created.id,
        title: created.title,
        duration: '04:00',
      });
      expect(updated.artists.map((a) => a.name)).toEqual([
        `${artistPrefix} three`,
      ]);
    });

    it('rejects an empty update', async () => {
      const created = await create(base, song('empty update'));

      const res = await asAdmin(http().put(`${base}/${created.id}`))
        .send({})
        .expect(400);
      expect(message(res)).toBe('Song update payload is required');
    });

    it('deletes a song, after which it is a 404', async () => {
      const created = await create(base, song('doomed'));

      await asAdmin(http().delete(`${base}/${created.id}`)).expect(204);
      await http().get(`${base}/${created.id}`).expect(404);
    });

    describe('mass assignment: an `id` in the body', () => {
      it('is ignored on create — a new song, the target untouched', async () => {
        const target = await create(base, song('create target'));

        const res = await asAdmin(http().post(base))
          .send({ ...song('create intruder'), id: target.id })
          .expect(201);
        const intruder = res.body as SongBody;

        expect(intruder.id).not.toBe(target.id);
        const after = await http().get(`${base}/${target.id}`).expect(200);
        expect((after.body as SongBody).title).toBe(target.title);
      });

      it('is ignored on update — the song keeps its id, the other is untouched', async () => {
        const edited = await create(base, song('update edited'));
        const other = await create(base, song('update other'));

        const res = await asAdmin(http().put(`${base}/${edited.id}`))
          .send({ id: other.id, duration: '05:00' })
          .expect(200);

        expect((res.body as SongBody).id).toBe(edited.id);
        const after = await http().get(`${base}/${other.id}`).expect(200);
        expect(after.body as SongBody).toMatchObject({
          title: other.title,
          duration: other.duration,
        });
      });
    });
  });

  describe('the two routes, side by side', () => {
    it('return the same song for the same payload, ids aside', async () => {
      const body = song('twin', ['one', 'two']);
      const [typeorm, prismaSong] = [
        await create('/songs', body),
        await create('/prisma/songs', body),
      ];

      expect(withoutIds(prismaSong)).toEqual(withoutIds(typeorm));
    });

    it('give the same validation messages', async () => {
      const invalid = { ...song('invalid'), duration: 'banana', artists: [] };
      const [a, b] = [
        await asAdmin(http().post('/songs')).send(invalid).expect(400),
        await asAdmin(http().post('/prisma/songs')).send(invalid).expect(400),
      ];

      expect(message(b)).toEqual(message(a));
    });

    it('give the same 404 message for a missing song', async () => {
      const missing = 2_000_000_000;
      for (const method of ['get', 'put', 'delete'] as const) {
        const send = (base: string) =>
          asAdmin(http()[method](`${base}/${missing}`)).send(
            method === 'put' ? { duration: '04:00' } : {},
          );
        const [a, b] = [await send('/songs'), await send('/prisma/songs')];

        expect([a.status, b.status]).toEqual([404, 404]);
        expect(message(b)).toEqual(message(a));
      }
    });
  });
});
