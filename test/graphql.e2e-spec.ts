import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { App } from 'supertest/types';
import { In, Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { User, UserRole } from './../src/users/entities/user.entity';
import { Song } from './../src/songs/entities/song.entity';
import { Artist } from './../src/artists/entities/artist.entity';

interface GqlError {
  message: string;
  extensions: { code: string; statusCode?: number };
}

interface GqlResponse {
  status: number;
  headers: Record<string, string>;
  data?: Record<string, unknown> | null;
  errors?: GqlError[];
}

// Runs against the real app + the dev databases from `.env` (no separate
// test DB), so every row this suite could create is keyed by `stamp` and
// deleted again in `afterAll` — including rows that only exist because a
// test failed (e.g. a guard regression letting a non-admin create a song).
describe('GraphQL API (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;

  const stamp = Date.now();
  const password = 'password123';
  const userEmail = `e2e-${stamp}-user@example.com`;
  const adminEmail = `e2e-${stamp}-admin@example.com`;
  const invalidEmail = `e2e-${stamp}-short@example.com`;
  const songTitle = `E2E Song ${stamp}`;
  const staleSongTitle = `E2E Song ${stamp} stale`;
  const artistNames = [`E2E Artist ${stamp} A`, `E2E Artist ${stamp} B`];
  let userToken: string;
  let adminToken: string;

  /** POSTs one GraphQL operation, optionally as a bearer-authenticated user. */
  async function gql(
    query: string,
    variables?: Record<string, unknown>,
    token?: string,
  ): Promise<GqlResponse> {
    const req = request(app.getHttpServer()).post('/graphql');

    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }

    const res = await req.send({ query, variables });
    const body = res.body as Omit<GqlResponse, 'status' | 'headers'>;
    return {
      status: res.status,
      headers: res.headers,
      ...body,
    };
  }

  const SIGNUP = `mutation ($input: SignupDto!) {
    signup(input: $input) { id email }
  }`;
  const LOGIN = `mutation ($input: LoginDto!) {
    login(input: $input) { accessToken }
  }`;

  async function loginAs(email: string): Promise<string> {
    const res = await gql(LOGIN, { input: { email, password } });
    return (res.data?.login as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    usersRepository = app.get(getRepositoryToken(User));
  });

  afterAll(async () => {
    await app.get<Repository<Song>>(getRepositoryToken(Song)).delete({
      title: In([songTitle, staleSongTitle]),
    });
    // `SongsService.remove` never deletes artists (known gap since
    // Project 2), so without this every run would leak its Artist rows.
    await app.get<Repository<Artist>>(getRepositoryToken(Artist)).delete({
      name: In(artistNames),
    });
    await usersRepository.delete({
      email: In([userEmail, adminEmail, invalidEmail]),
    });
    await app.close();
  });

  describe('public queries', () => {
    it('songs returns a paginated page with no token', async () => {
      const res = await gql(
        `{ songs(page: 1, limit: 5) { total data { id title } } }`,
      );

      const songs = res.data?.songs as { data: unknown; total: unknown };
      expect(res.errors).toBeUndefined();
      expect(Array.isArray(songs.data)).toBe(true);
      expect(typeof songs.total).toBe('number');
    });

    it('song reports a missing id as NotFoundException in errors[], not an HTTP error', async () => {
      const res = await gql(`{ song(id: 999999) { id } }`);

      expect(res.status).toBe(200);
      expect(res.data).toBeNull();
      expect(res.errors?.[0].extensions).toMatchObject({
        code: 'NotFoundException',
        statusCode: 404,
      });
    });

    it('rejects a wrongly-typed argument before any resolver runs', async () => {
      const res = await gql(`{ song(id: "abc") { id } }`);

      expect(res.status).toBe(400);
      expect(res.data).toBeUndefined();
      expect(res.errors?.[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');
    });
  });

  describe('auth', () => {
    it('signs up, logs in, and reads its own profile with the token', async () => {
      const signup = await gql(SIGNUP, {
        input: { email: userEmail, password },
      });
      expect(signup.data?.signup).toMatchObject({ email: userEmail });

      const login = await gql(LOGIN, { input: { email: userEmail, password } });
      userToken = (login.data?.login as { accessToken: string }).accessToken;
      expect(typeof userToken).toBe('string');

      const profile = await gql(`{ profile { email role } }`, {}, userToken);
      expect(profile.data?.profile).toEqual({ email: userEmail, role: 'USER' });
    });

    it('rejects an invalid signup input via ValidationPipe', async () => {
      const res = await gql(SIGNUP, {
        input: { email: invalidEmail, password: 'abc' },
      });

      expect(res.errors?.[0].extensions.code).toBe('BadRequestException');
    });

    it('rejects a wrong password', async () => {
      const res = await gql(LOGIN, {
        input: { email: userEmail, password: 'not-the-password' },
      });

      expect(res.errors?.[0].extensions.code).toBe('UnauthorizedException');
    });

    it('rejects profile without a token', async () => {
      const res = await gql(`{ profile { email } }`);

      expect(res.errors?.[0].extensions.code).toBe('UnauthorizedException');
    });
  });

  describe('guarded song mutations', () => {
    const CREATE_SONG = `mutation ($input: CreateSongDto!) {
      createSong(input: $input) { id title }
    }`;
    const input = {
      title: songTitle,
      artists: artistNames,
      releaseDate: '2024-01-01',
      duration: '03:30',
    };
    let createdSongId: number;

    beforeAll(async () => {
      // No API promotes a user to admin, on purpose — same manual step as
      // `rest-client.http`'s SQL UPDATE, done through the app's own repo.
      await gql(SIGNUP, { input: { email: adminEmail, password } });
      await usersRepository.update(
        { email: adminEmail },
        { role: UserRole.ADMIN },
      );
      // Log in only *after* promoting — the role travels inside the JWT,
      // so a token minted before the UPDATE would still say USER.
      adminToken = await loginAs(adminEmail);
    });

    it('rejects createSong without a token', async () => {
      const res = await gql(CREATE_SONG, { input });

      expect(res.errors?.[0].extensions.code).toBe('UnauthorizedException');
    });

    it('rejects createSong for a non-admin user', async () => {
      const res = await gql(CREATE_SONG, { input }, userToken);

      expect(res.errors?.[0].extensions.code).toBe('ForbiddenException');
    });

    it('lets an admin create a song', async () => {
      const res = await gql(CREATE_SONG, { input }, adminToken);

      expect(res.errors).toBeUndefined();
      expect(res.data?.createSong).toMatchObject({ title: input.title });
      createdSongId = (res.data?.createSong as { id: number }).id;
    });

    it('resolves artists through the batched field on both read paths', async () => {
      // Neither query joins artists any more — both go through the
      // per-request DataLoader behind `Song.artists`.
      const single = await gql(
        `query ($id: Int!) { song(id: $id) { artists { name } } }`,
        { id: createdSongId },
      );
      const list = await gql(
        `{ songs(limit: 100) { data { id artists { name } } } }`,
      );

      const names = (artists: { name: string }[]) =>
        artists.map((artist) => artist.name).sort();
      const fromSingle = (single.data?.song as { artists: { name: string }[] })
        .artists;
      const fromList = (
        list.data?.songs as {
          data: { id: number; artists: { name: string }[] }[];
        }
      ).data.find((song) => song.id === createdSongId)?.artists;

      expect(single.errors).toBeUndefined();
      expect(list.errors).toBeUndefined();
      expect(names(fromSingle)).toEqual(artistNames);
      expect(names(fromList ?? [])).toEqual(artistNames);
    });

    it('lets an admin delete that song, after which it is gone', async () => {
      const res = await gql(
        `mutation ($id: Int!) { deleteSong(id: $id) }`,
        { id: createdSongId },
        adminToken,
      );
      expect(res.data?.deleteSong).toBe(true);

      const lookup = await gql(`query ($id: Int!) { song(id: $id) { id } }`, {
        id: createdSongId,
      });
      expect(lookup.errors?.[0].extensions.code).toBe('NotFoundException');
    });
  });

  // Runs last: it needs the user and admin tokens from the sections above.
  // Each E2E file boots its own app, so the in-memory cache starts empty,
  // and cache keys are the query text + variables, so the queries here
  // don't collide with any earlier test's.
  describe('response caching', () => {
    const CACHED_LIST = `{ songs(limit: 50) { total data { title artists { name } } } }`;
    let totalBefore: number;

    it('serves a repeated public query from the cache', async () => {
      const first = await gql(CACHED_LIST);
      expect(first.errors).toBeUndefined();
      expect(first.headers['cache-control']).toBe('max-age=30, public');
      expect(first.headers['age']).toBeUndefined();
      totalBefore = (first.data?.songs as { total: number }).total;

      const second = await gql(CACHED_LIST);
      // `age` is only set on a cache hit: no resolver ran for this one.
      expect(second.headers['age']).toBeDefined();
      expect(second.data).toEqual(first.data);
    });

    it('keeps serving the cached result after a write, until it expires', async () => {
      const created = await gql(
        `mutation ($input: CreateSongDto!) { createSong(input: $input) { id } }`,
        {
          input: {
            title: staleSongTitle,
            artists: artistNames,
            releaseDate: '2024-01-01',
            duration: '03:30',
          },
        },
        adminToken,
      );
      expect(created.errors).toBeUndefined();

      // Same query text → same cache entry → the pre-write total. This is
      // the accepted trade-off of a 30s maxAge with no invalidation.
      const cached = await gql(CACHED_LIST);
      expect(cached.headers['age']).toBeDefined();
      expect((cached.data?.songs as { total: number }).total).toBe(totalBefore);

      // A different query text is a different cache key, so it reaches the
      // database — which does have the new song.
      const fresh = await gql(`{ songs(limit: 51) { total } }`);
      expect(fresh.headers['age']).toBeUndefined();
      expect((fresh.data?.songs as { total: number }).total).toBe(
        totalBefore + 1,
      );
    });

    it('never caches profile, so two users never see each other', async () => {
      const PROFILE = `{ profile { email } }`;

      const asUser = await gql(PROFILE, {}, userToken);
      const asAdmin = await gql(PROFILE, {}, adminToken);

      expect(asUser.data?.profile).toEqual({ email: userEmail });
      expect(asAdmin.data?.profile).toEqual({ email: adminEmail });
      expect(asAdmin.headers['cache-control']).toBe('no-store');
      expect(asAdmin.headers['age']).toBeUndefined();
    });

    it('makes a whole response uncacheable if any field in it is private', async () => {
      const MIXED = `{ songs(limit: 52) { total } profile { email } }`;

      await gql(MIXED, {}, userToken);
      const second = await gql(MIXED, {}, userToken);

      expect(second.errors).toBeUndefined();
      expect(second.headers['cache-control']).toBe('no-store');
      expect(second.headers['age']).toBeUndefined();
    });
  });
});
