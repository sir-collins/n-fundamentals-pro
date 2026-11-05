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

// Project 9's transactions: the all-or-nothing song import (an interactive
// $transaction) against the real Postgres. The rollback tests check the
// database directly through PrismaService, not just the status code —
// a 409 alone wouldn't show that earlier songs in the batch were undone.
// Setup mirrors prisma-bulk.e2e-spec.ts, keyed by `stamp`.
jest.setTimeout(15_000);

describe('Prisma transactions (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  let prisma: PrismaService;

  const stamp = Date.now();
  const password = 'password123';
  const userEmail = `e2e-${stamp}-tx-user@example.com`;
  const adminEmail = `e2e-${stamp}-tx-admin@example.com`;
  const songPrefix = `E2E Tx Song ${stamp}`;
  const artistPrefix = `E2E Tx Artist ${stamp}`;
  const title = (name: string) => `${songPrefix} ${name}`;
  const artist = (name: string) => `${artistPrefix} ${name}`;
  const song = (name: string, artists: string[]) => ({
    title: title(name),
    artists: artists.map(artist),
    releaseDate: '2024-01-15',
    duration: '03:45',
  });

  let userToken: string;
  let adminToken: string;

  const url = '/prisma/songs/bulk';
  const http = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${adminToken}`);
  const asUser = (req: request.Test) =>
    req.set('Authorization', `Bearer ${userToken}`);
  const message = (res: request.Response) =>
    String((res.body as { message: unknown }).message);

  // Straight to the database, bypassing the API under test.
  const songExists = async (name: string) =>
    (await prisma.song.count({ where: { title: title(name) } })) > 0;
  const artistExists = async (name: string) =>
    (await prisma.artist.count({ where: { name: artist(name) } })) > 0;

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

    // The title the rollback tests collide with.
    await asAdmin(http().post('/prisma/songs'))
      .send(song('existing', ['existing']))
      .expect(201);
  });

  afterAll(async () => {
    // Songs (cascading their join rows), then the now-orphaned artists.
    await prisma.song.deleteMany({
      where: { title: { startsWith: songPrefix } },
    });
    await prisma.artist.deleteMany({
      where: { name: { startsWith: artistPrefix } },
    });
    await users.delete({ email: In([userEmail, adminEmail]) });
    await app.close();
  });

  describe('POST /prisma/songs/bulk (interactive transaction)', () => {
    it('requires an admin', async () => {
      const body = { songs: [song('auth', ['auth'])] };

      await http().post(url).send(body).expect(401);
      await asUser(http().post(url)).send(body).expect(403);
      expect(await songExists('auth')).toBe(false);
    });

    it.each([
      ['an empty array', []],
      [
        'more than 100 songs',
        Array.from({ length: 101 }, (_, i) => song(`many ${i}`, ['many'])),
      ],
      [
        'an invalid nested field',
        [{ ...song('banana', ['banana']), releaseDate: 'banana' }],
      ],
    ])('rejects %s with a 400', async (_, songs) => {
      await asAdmin(http().post(url)).send({ songs }).expect(400);
      expect(await songExists('banana')).toBe(false);
    });

    it('creates every song, sharing a new artist between them', async () => {
      const res = await asAdmin(http().post(url))
        .send({
          songs: [song('one', ['shared', 'solo']), song('two', ['shared'])],
        })
        .expect(201);
      const created = res.body as SongWithArtists[];

      expect(created.map((s) => s.title)).toEqual([title('one'), title('two')]);
      // connectOrCreate created "shared" for song one, then connected
      // song two to that same row.
      const sharedIds = created.map(
        (s) => s.artists.find((a) => a.name === artist('shared'))?.id,
      );
      expect(sharedIds[0]).toBeDefined();
      expect(sharedIds[1]).toBe(sharedIds[0]);
      expect(
        await prisma.artist.count({ where: { name: artist('shared') } }),
      ).toBe(1);
    });

    it('rolls back every song when a later title already exists', async () => {
      const res = await asAdmin(http().post(url))
        .send({
          songs: [
            song('rollback A', ['rollback only']),
            song('rollback B', ['rollback only']),
            song('existing', ['existing']),
          ],
        })
        .expect(409);

      expect(message(res)).toBe(
        `A song titled "${title('existing')}" already exists`,
      );
      // A and B were inserted before the conflict — and undone with it,
      // along with the artist only they had created.
      expect(await songExists('rollback A')).toBe(false);
      expect(await songExists('rollback B')).toBe(false);
      expect(await artistExists('rollback only')).toBe(false);
      // The pre-existing song is untouched.
      expect(
        await prisma.song.count({ where: { title: title('existing') } }),
      ).toBe(1);
    });

    it('treats a title repeated within the batch as a conflict too', async () => {
      await asAdmin(http().post(url))
        .send({
          songs: [song('twice', ['twice']), song('twice', ['twice'])],
        })
        .expect(409);

      expect(await songExists('twice')).toBe(false);
      expect(await artistExists('twice')).toBe(false);
    });
  });

  describe('GET /prisma/songs (batch transaction)', () => {
    it('still returns a page and a matching total', async () => {
      const res = await http().get('/prisma/songs?page=1&limit=5').expect(200);
      const { data, total } = res.body as {
        data: SongWithArtists[];
        total: number;
      };

      expect(data.length).toBeLessThanOrEqual(5);
      expect(total).toBe(await prisma.song.count());
    });
  });
});
