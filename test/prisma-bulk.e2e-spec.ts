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
import type { Album } from './../src/generated/prisma/client';
import { PrismaService } from './../src/prisma/prisma.service';
import type { SongWithArtists } from './../src/prisma-songs/prisma-songs.service';

// Project 9's bulk operations — createManyAndReturn, updateMany and a
// deleteMany with a relation filter — against the real Postgres. Setup
// mirrors prisma-relations.e2e-spec.ts, keyed by `stamp`.
//
// Note: DELETE /prisma/artists/orphans removes *every* orphan artist in
// the database, not only this suite's. Fine against a local dev database;
// the assertions only look at this suite's stamped artists.
jest.setTimeout(15_000);

describe('Prisma bulk operations (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  let prisma: PrismaService;

  const stamp = Date.now();
  const password = 'password123';
  const userEmail = `e2e-${stamp}-bulk-user@example.com`;
  const adminEmail = `e2e-${stamp}-bulk-admin@example.com`;
  const songTitle = (n: number) => `E2E Bulk Song ${stamp} ${n}`;
  const artistPrefix = `E2E Bulk Artist ${stamp}`;
  const keeper = `${artistPrefix} keeper`;
  const orphan = `${artistPrefix} orphan`;
  const orphanWithAlbum = `${artistPrefix} orphan with album`;
  const albumTitle = (n: number) => `E2E Bulk Album ${stamp} ${n}`;
  const album = (n: number) => ({
    title: albumTitle(n),
    releaseDate: '2020-03-20',
  });

  let userToken: string;
  let adminToken: string;
  const songIds: number[] = [];
  const artistIds: Record<string, number> = {};

  const http = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${adminToken}`);
  const asUser = (req: request.Test) =>
    req.set('Authorization', `Bearer ${userToken}`);
  const message = (res: request.Response) =>
    String((res.body as { message: unknown }).message);

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return (res.body as { access_token: string }).access_token;
  }

  async function createSong(n: number, artists: string[]): Promise<void> {
    const res = await asAdmin(http().post('/prisma/songs'))
      .send({
        title: songTitle(n),
        artists,
        releaseDate: '2024-01-15',
        duration: '03:45',
      })
      .expect(201);
    const song = res.body as SongWithArtists;
    songIds.push(song.id);
    for (const a of song.artists) {
      artistIds[a.name] = a.id;
    }
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

    await createSong(1, [keeper, orphan]);
    await createSong(2, [orphanWithAlbum]);
  });

  afterAll(async () => {
    // Songs, then albums (Restrict), then artists.
    await prisma.song.deleteMany({
      where: { title: { startsWith: `E2E Bulk Song ${stamp}` } },
    });
    await prisma.album.deleteMany({
      where: { title: { startsWith: `E2E Bulk Album ${stamp}` } },
    });
    await prisma.artist.deleteMany({
      where: { name: { startsWith: artistPrefix } },
    });
    await users.delete({ email: In([userEmail, adminEmail]) });
    await app.close();
  });

  describe('POST /prisma/artists/:id/albums/bulk (createManyAndReturn)', () => {
    const url = () => `/prisma/artists/${artistIds[keeper]}/albums/bulk`;

    it('requires an admin', async () => {
      await http()
        .post(url())
        .send({ albums: [album(1)] })
        .expect(401);
      await asUser(http().post(url()))
        .send({ albums: [album(1)] })
        .expect(403);
    });

    it('creates every album in one request', async () => {
      const res = await asAdmin(http().post(url()))
        .send({ albums: [album(1), album(2), album(3)] })
        .expect(201);
      const { created } = res.body as { created: Album[] };

      expect(created.map((a) => a.title).sort()).toEqual([
        albumTitle(1),
        albumTitle(2),
        albumTitle(3),
      ]);
    });

    it('skips titles the artist already has, returning only new ones', async () => {
      const res = await asAdmin(http().post(url()))
        .send({ albums: [album(1), album(2), album(4)] })
        .expect(201);
      const { created } = res.body as { created: Album[] };

      expect(created.map((a) => a.title)).toEqual([albumTitle(4)]);
      expect(
        await prisma.album.count({ where: { artistId: artistIds[keeper] } }),
      ).toBe(4);
    });

    it('validates each album inside the array', async () => {
      const res = await asAdmin(http().post(url()))
        .send({ albums: [album(5), { ...album(6), releaseDate: 'banana' }] })
        .expect(400);

      // The path to the failing field, element index included.
      expect(message(res)).toContain('albums.1.releaseDate');
      expect(
        await prisma.album.count({ where: { title: albumTitle(5) } }),
      ).toBe(0);
    });

    it('rejects an empty array and more than 100 albums', async () => {
      await asAdmin(http().post(url())).send({ albums: [] }).expect(400);

      const tooMany = Array.from({ length: 101 }, (_, i) => album(100 + i));
      const res = await asAdmin(http().post(url()))
        .send({ albums: tooMany })
        .expect(400);
      expect(message(res)).toContain('albums');
    });

    it('is a 404 for a missing artist (not a 500)', async () => {
      await asAdmin(http().post('/prisma/artists/999999/albums/bulk'))
        .send({ albums: [album(1)] })
        .expect(404);
    });
  });

  describe('PATCH /prisma/songs/bulk (updateMany)', () => {
    it('requires an admin', async () => {
      await http()
        .patch('/prisma/songs/bulk')
        .send({ ids: songIds, duration: '04:00' })
        .expect(401);
      await asUser(http().patch('/prisma/songs/bulk'))
        .send({ ids: songIds, duration: '04:00' })
        .expect(403);
    });

    it('updates every listed song, ignoring ids with no song', async () => {
      const res = await asAdmin(http().patch('/prisma/songs/bulk'))
        .send({ ids: [...songIds, 999999], duration: '04:00' })
        .expect(200);

      expect(res.body).toEqual({ count: 2 });
      const songs = await prisma.song.findMany({
        where: { id: { in: songIds } },
      });
      expect(songs.map((s) => s.duration)).toEqual(['04:00', '04:00']);
      // Untouched fields stay as they were.
      expect(songs.map((s) => s.releaseDate)).toEqual([
        '2024-01-15',
        '2024-01-15',
      ]);
    });

    it('rejects a body with nothing to change', async () => {
      const res = await asAdmin(http().patch('/prisma/songs/bulk'))
        .send({ ids: songIds })
        .expect(400);

      expect(message(res)).toContain('releaseDate or duration');
    });

    it('validates the fields', async () => {
      const res = await asAdmin(http().patch('/prisma/songs/bulk'))
        .send({ ids: songIds, duration: 'banana' })
        .expect(400);

      expect(message(res)).toContain('duration');
    });
  });

  describe('DELETE /prisma/artists/orphans (deleteMany + relation filter)', () => {
    beforeAll(async () => {
      // Take `orphan` off song 1, and `orphanWithAlbum` off song 2 after
      // giving them an album: two artists with no songs, one with an album.
      await asAdmin(
        http().post(`/prisma/artists/${artistIds[orphanWithAlbum]}/albums`),
      )
        .send(album(50))
        .expect(201);
      await asAdmin(http().put(`/prisma/songs/${songIds[0]}`))
        .send({ artists: [keeper] })
        .expect(200);
      await asAdmin(http().put(`/prisma/songs/${songIds[1]}`))
        .send({ artists: [keeper] })
        .expect(200);
    });

    it('requires an admin', async () => {
      await http().delete('/prisma/artists/orphans').expect(401);
      await asUser(http().delete('/prisma/artists/orphans')).expect(403);
    });

    it('deletes only artists with no songs and no albums', async () => {
      const res = await asAdmin(
        http().delete('/prisma/artists/orphans'),
      ).expect(200);

      // Possibly more than 1: every orphan in the database counts.
      expect((res.body as { count: number }).count).toBeGreaterThanOrEqual(1);
      const left = await prisma.artist.findMany({
        where: { name: { startsWith: artistPrefix } },
        orderBy: { name: 'asc' },
      });
      expect(left.map((a) => a.name)).toEqual([keeper, orphanWithAlbum]);
    });
  });
});
