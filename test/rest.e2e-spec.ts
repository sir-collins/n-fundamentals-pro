import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getModelToken } from '@nestjs/mongoose';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { App } from 'supertest/types';
import { In, Repository } from 'typeorm';
import { Model } from 'mongoose';
import { authenticator } from 'otplib';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { User, UserRole } from './../src/users/entities/user.entity';
import { Song } from './../src/songs/entities/song.entity';
import { Artist } from './../src/artists/entities/artist.entity';
import { ApiKey } from './../src/auth/entities/api-key.entity';
import { Comment } from './../src/comments/schemas/comment.schema';
import { MailService } from './../src/mail/mail.service';
import { SongsService } from './../src/songs/songs.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
  ORPHAN_ARTISTS_CLEANUP,
  OrphanArtistsCleanupJob,
} from './../src/artists/orphan-artists-cleanup.job';

/** REST's error shape, from AllExceptionsFilter. */
interface RestError {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | string[];
}

// The REST counterpart to graphql.e2e-spec.ts: the real app against the
// real Postgres *and* MongoDB from `.env`. Everything created is keyed by
// `stamp` and removed in `afterAll` — including API keys (a plain
// `userId` column, so nothing cascades) and Mongo comments (no cascades
// at all).
// File-wide (jest.setTimeout always is): real HTTP + DB work. The one 2FA
// test that may wait ~30s for a fresh TOTP step sets its own, longer one.
jest.setTimeout(15_000);

describe('REST API (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;

  const stamp = Date.now();
  const password = 'password123';
  const email = (who: string) => `e2e-${stamp}-${who}@example.com`;
  const userEmail = email('rest-user');
  const otherEmail = email('rest-other');
  const adminEmail = email('rest-admin');
  const tfaEmail = email('rest-2fa');
  const welcomeEmail = email('rest-welcome');
  const songTitle = `E2E REST Song ${stamp}`;
  const doomedSongTitle = `E2E REST Song ${stamp} doomed`;
  const artistName = `E2E REST Artist ${stamp}`;
  const cleanupSongTitle = `E2E REST Song ${stamp} cleanup`;
  const keptArtistName = `E2E REST Artist ${stamp} kept`;
  const orphanArtistName = `E2E REST Artist ${stamp} orphan`;

  let userToken: string;
  let otherToken: string;
  let adminToken: string;
  let songId: number;

  const http = () => request(app.getHttpServer());

  async function signup(address: string): Promise<void> {
    await http()
      .post('/auth/signup')
      .send({ email: address, password })
      .expect(201);
  }

  async function login(address: string): Promise<string> {
    const res = await http()
      .post('/auth/login')
      .send({ email: address, password })
      .expect(200);
    return (res.body as { access_token: string }).access_token;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    // listen (which runs init itself), not just init: against a server
    // that isn't listening, supertest opens a listener per request and
    // closes it when that request ends — under the 2FA race test's
    // concurrent requests, the first to finish would close the server
    // under the rest (ECONNRESET). One real listener avoids that.
    await app.listen(0);

    users = app.get(getRepositoryToken(User));

    for (const address of [userEmail, otherEmail, adminEmail, tfaEmail]) {
      await signup(address);
    }
    // No API promotes to admin, on purpose — same manual step as
    // rest-client.http, then log in so the role is in the token.
    await users.update({ email: adminEmail }, { role: UserRole.ADMIN });

    userToken = await login(userEmail);
    otherToken = await login(otherEmail);
    adminToken = await login(adminEmail);
  });

  afterAll(async () => {
    const created = await users.findBy({
      email: In([userEmail, otherEmail, adminEmail, tfaEmail, welcomeEmail]),
    });
    const userIds = created.map((u) => u.id);
    const songs = app.get<Repository<Song>>(getRepositoryToken(Song));
    const songIds = (
      await songs.findBy({
        title: In([songTitle, doomedSongTitle, cleanupSongTitle]),
      })
    ).map((s) => s.id);

    await app
      .get<Model<Comment>>(getModelToken(Comment.name))
      .deleteMany({ songId: { $in: songIds } });
    await app
      .get<Repository<ApiKey>>(getRepositoryToken(ApiKey))
      .delete({ userId: In(userIds) });
    await songs.delete({
      title: In([songTitle, doomedSongTitle, cleanupSongTitle]),
    });
    await app
      .get<Repository<Artist>>(getRepositoryToken(Artist))
      .delete({ name: In([artistName, keptArtistName, orphanArtistName]) });
    await users.delete({ id: In(userIds) });
    await app.close();
  });

  describe('songs', () => {
    const body = {
      title: songTitle,
      artists: [artistName],
      releaseDate: '2024-01-01',
      duration: '03:30',
    };

    it('lists songs publicly, paginated', async () => {
      const res = await http().get('/songs?page=1&limit=5').expect(200);

      expect(Array.isArray((res.body as { data: unknown }).data)).toBe(true);
      expect(typeof (res.body as { total: unknown }).total).toBe('number');
    });

    it("reports a missing song in REST's own error format", async () => {
      const res = await http().get('/songs/999999').expect(404);

      expect(res.body).toEqual({
        statusCode: 404,
        timestamp: expect.any(String),
        path: '/songs/999999',
        message: 'Song with id 999999 was not found',
      });
      expect(Number.isNaN(Date.parse((res.body as RestError).timestamp))).toBe(
        false,
      );
    });

    it('logs an unexpected failure and returns a generic 500', async () => {
      const findOne = jest
        .spyOn(app.get(SongsService), 'findOne')
        .mockRejectedValue(new Error('connection refused'));
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      try {
        const res = await http().get('/songs/1').expect(500);

        expect(res.body).toEqual({
          statusCode: 500,
          timestamp: expect.any(String),
          path: '/songs/1',
          message: 'Internal server error',
        });
        expect(logError).toHaveBeenCalledWith(
          'GET /songs/1 failed',
          expect.stringContaining('connection refused'),
        );
      } finally {
        findOne.mockRestore();
        logError.mockRestore();
      }
    });

    it('rejects a non-numeric id before any handler runs', async () => {
      const res = await http().get('/songs/abc').expect(400);

      expect((res.body as RestError).path).toBe('/songs/abc');
    });

    it('requires a token to create a song', async () => {
      await http().post('/songs').send(body).expect(401);
    });

    it('forbids a non-admin from creating a song', async () => {
      await http()
        .post('/songs')
        .set('Authorization', `Bearer ${userToken}`)
        .send(body)
        .expect(403);
    });

    it('validates the body, listing every failed rule', async () => {
      const res = await http()
        .post('/songs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...body, duration: 'not-a-time', artists: [] })
        .expect(400);

      const { message } = res.body as RestError;
      expect(Array.isArray(message)).toBe(true);
      expect(message.length).toBeGreaterThanOrEqual(1);
    });

    it('lets an admin create, then update, a song', async () => {
      const created = await http()
        .post('/songs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body)
        .expect(201);
      const song = created.body as Song;
      expect(song).toMatchObject({ title: songTitle });
      expect(song.artists.map((a) => a.name)).toEqual([artistName]);
      songId = song.id;

      const updated = await http()
        .put(`/songs/${songId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ duration: '04:00' })
        .expect(200);
      expect(updated.body).toMatchObject({ id: songId, duration: '04:00' });
    });

    it('validates the update body too', async () => {
      // Regression: the body was typed `Partial<CreateSongDto>`, which is
      // erased at runtime, so nothing was validated and this was saved.
      const res = await http()
        .put(`/songs/${songId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ duration: 'banana' })
        .expect(400);

      // The rule that failed, not just any 400 (a bad id is one too).
      expect(String((res.body as RestError).message)).toContain('duration');
    });

    it('lets an admin delete a song, after which it is gone', async () => {
      const created = await http()
        .post('/songs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...body, title: doomedSongTitle })
        .expect(201);
      const doomedId = (created.body as Song).id;

      await http()
        .delete(`/songs/${doomedId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
      await http().get(`/songs/${doomedId}`).expect(404);
    });
  });

  describe('orphaned artist cleanup (CRON)', () => {
    it('registers the job with the scheduler, nightly at 03:00 UTC', () => {
      const job = app.get(SchedulerRegistry).getCronJob(ORPHAN_ARTISTS_CLEANUP);

      expect(job.cronTime.source).toBe('0 03 * * *');
      expect(job.nextDate().toUTC()).toMatchObject({ hour: 3, minute: 0 });
    });

    it('deletes an artist taken off its only song, keeping the rest', async () => {
      const artists = app.get<Repository<Artist>>(getRepositoryToken(Artist));
      const created = await http()
        .post('/songs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: cleanupSongTitle,
          artists: [keptArtistName, orphanArtistName],
          releaseDate: '2024-01-01',
          duration: '03:30',
        })
        .expect(201);
      await http()
        .put(`/songs/${(created.body as Song).id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ artists: [keptArtistName] })
        .expect(200);
      expect(await artists.existsBy({ name: orphanArtistName })).toBe(true);

      // Call the job directly instead of waiting for 03:00.
      await app.get(OrphanArtistsCleanupJob).handleCleanup();

      expect(await artists.existsBy({ name: orphanArtistName })).toBe(false);
      expect(await artists.existsBy({ name: keptArtistName })).toBe(true);
    });
  });

  describe('welcome email (Event Emitter)', () => {
    it('sends it after signup, and a mail failure does not fail signup', async () => {
      const mail = app.get(MailService);
      const sendWelcome = jest
        .spyOn(mail, 'sendWelcomeEmail')
        .mockRejectedValue(new Error('SMTP down'));

      try {
        await signup(welcomeEmail);

        // The listener is async: it runs after the response, so wait for it.
        for (let i = 0; i < 50 && sendWelcome.mock.calls.length === 0; i++) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(sendWelcome).toHaveBeenCalledWith(welcomeEmail);
      } finally {
        sendWelcome.mockRestore();
      }
    });
  });

  describe('two-factor authentication (real TOTP codes)', () => {
    let tfaToken: string;

    beforeAll(async () => {
      tfaToken = await login(tfaEmail);
    });

    // The secret lives only in the database (shown to a human as a QR
    // code), so the test reads it back and computes codes with the same
    // library an authenticator app's algorithm matches.
    //
    // Each code works once (replay protection), so a test needing a new
    // one must wait until the step after the last one spent — up to ~30s.
    // No boundary juggling needed: the app accepts the previous step too
    // (`window: 1`), so a code generated at :29 that lands at :31 is fine.
    const currentStep = () => Math.floor(Date.now() / 1000 / 30);
    let lastSpentStep = 0;

    async function freshCode(): Promise<string> {
      while (currentStep() <= lastSpentStep) {
        await new Promise((resolve) =>
          setTimeout(resolve, authenticator.timeRemaining() * 1000 + 100),
        );
      }
      lastSpentStep = currentStep();
      const user = await users.findOneByOrFail({ email: tfaEmail });
      return authenticator.generate(user.twoFactorSecret!);
    }

    it('refuses to turn 2FA on before a secret exists', async () => {
      await http()
        .post('/auth/2fa/turn-on')
        .set('Authorization', `Bearer ${tfaToken}`)
        .send({ code: '123456' })
        .expect(400);
    });

    it('generates a secret as a QR code', async () => {
      const res = await http()
        .post('/auth/2fa/generate')
        .set('Authorization', `Bearer ${tfaToken}`)
        .expect(200);

      expect((res.body as { qrCodeDataUrl: string }).qrCodeDataUrl).toMatch(
        /^data:image\/png;base64,/,
      );
    });

    it('rejects a wrong code, leaving 2FA off', async () => {
      await http()
        .post('/auth/2fa/turn-on')
        .set('Authorization', `Bearer ${tfaToken}`)
        .send({ code: '000000' })
        .expect(400);

      const user = await users.findOneByOrFail({ email: tfaEmail });
      expect(user.isTwoFactorEnabled).toBe(false);
    });

    it('turns 2FA on with a real code', async () => {
      await http()
        .post('/auth/2fa/turn-on')
        .set('Authorization', `Bearer ${tfaToken}`)
        .send({ code: await freshCode() })
        .expect(200);

      const user = await users.findOneByOrFail({ email: tfaEmail });
      expect(user.isTwoFactorEnabled).toBe(true);
    });

    it('withholds the access token at login, then accepts each code exactly once', async () => {
      // Several logins, so several separate tempTokens — the race below is
      // about the *code*, not a single token being reused.
      //
      // What this proves: under real concurrency, the real implementation
      // lets exactly one through. What it can't promise: catching a
      // read-then-save regression every run — that bug only shows when two
      // requests interleave between the read and the write, which happened
      // in ~1 run in 3 here (and no more often with 25 racers). The
      // deterministic guard is users.service.spec.ts pinning the
      // conditional WHERE; this test is the real-database proof.
      const RACERS = 10;
      const logins = await Promise.all(
        Array.from({ length: RACERS }, () =>
          http()
            .post('/auth/login')
            .send({ email: tfaEmail, password })
            .expect(200),
        ),
      );
      const tempTokens = logins.map((res) => {
        const body = res.body as {
          access_token?: string;
          twoFactorRequired?: boolean;
          tempToken: string;
        };
        expect(body.access_token).toBeUndefined();
        expect(body.twoFactorRequired).toBe(true);
        return body.tempToken;
      });

      // A wrong code fails without consuming the tempToken...
      await http()
        .post('/auth/2fa/authenticate')
        .send({ tempToken: tempTokens[0], code: '000000' })
        .expect(400);

      // ...then the same valid code, sent on all of them at the same moment:
      // exactly one may win. Only a real database can prove this — it's
      // the conditional UPDATE in UsersService.consumeTotpStep that decides.
      const code = await freshCode();
      const raced = await Promise.all(
        tempTokens.map((tempToken) =>
          http().post('/auth/2fa/authenticate').send({ tempToken, code }),
        ),
      );
      const winners = raced.filter((res) => res.status === 200);
      const losers = raced.filter((res) => res.status === 400);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(RACERS - 1);
      for (const loser of losers) {
        expect((loser.body as { message: string }).message).toMatch(
          /already been used/,
        );
      }
      const [winner] = winners;

      // A plain replay afterwards is refused too.
      await http()
        .post('/auth/2fa/authenticate')
        .send({ tempToken: tempTokens[0], code })
        .expect(400);

      const { access_token } = winner.body as { access_token: string };
      const profile = await http()
        .get('/auth/profile')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      expect(profile.body).toMatchObject({ email: tfaEmail });
    }, 45_000);

    it('rejects a normal access token used as a tempToken', async () => {
      await http()
        .post('/auth/2fa/authenticate')
        .send({ tempToken: tfaToken, code: '123456' })
        .expect(401);
    });
  });

  describe('API keys', () => {
    let keyId: number;
    let rawKey: string;

    it('mints a key and authenticates with it instead of a JWT', async () => {
      const created = await http()
        .post('/auth/api-keys')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ label: 'e2e' })
        .expect(201);
      ({ id: keyId, apiKey: rawKey } = created.body as {
        id: number;
        apiKey: string;
      });

      const whoami = await http()
        .get('/auth/api-keys/whoami')
        .set('x-api-key', rawKey)
        .expect(200);
      expect(whoami.body).toMatchObject({
        email: userEmail,
        role: UserRole.USER,
      });
    });

    it('lists keys as metadata only', async () => {
      const res = await http()
        .get('/auth/api-keys')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      const keys = res.body as Record<string, unknown>[];

      expect(keys).toEqual([expect.objectContaining({ id: keyId })]);
      expect(keys[0]).not.toHaveProperty('hashedKey');
      expect(JSON.stringify(keys)).not.toContain(rawKey);
    });

    it("won't let another user revoke it", async () => {
      await http()
        .delete(`/auth/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });

    it('stops working once its owner revokes it', async () => {
      await http()
        .delete(`/auth/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(204);

      await http()
        .get('/auth/api-keys/whoami')
        .set('x-api-key', rawKey)
        .expect(401);
    });
  });

  describe('comments (MongoDB)', () => {
    let rootId: string;
    let othersId: string;

    const post = (token: string, body: Record<string, string>) =>
      http()
        .post(`/songs/${songId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    it('creates a comment and a reply, listing the reply with its parent populated', async () => {
      const root = await post(userToken, { body: 'First!' }).expect(201);
      rootId = (root.body as { _id: string })._id;

      await post(adminToken, {
        body: 'A reply',
        parentCommentId: rootId,
      }).expect(201);

      const list = await http().get(`/songs/${songId}/comments`).expect(200);
      const comments = (
        list.body as {
          data: {
            body: string;
            authorEmail: string;
            parentComment: { _id: string; body: string } | null;
          }[];
        }
      ).data;
      const reply = comments.find((c) => c.body === 'A reply');
      expect(reply?.authorEmail).toBe(adminEmail);
      // populate() replaced the ObjectId with the parent document itself.
      expect(reply?.parentComment).toMatchObject({
        _id: rootId,
        body: 'First!',
      });
    });

    it('pages through comments oldest first', async () => {
      const page = (n: number) =>
        http().get(`/songs/${songId}/comments?page=${n}&limit=1`).expect(200);

      const first = (await page(1)).body as {
        data: { body: string }[];
        total: number;
      };
      const second = (await page(2)).body as typeof first;

      expect(first.total).toBe(2);
      expect(first.data.map((c) => c.body)).toEqual(['First!']);
      expect(second.data.map((c) => c.body)).toEqual(['A reply']);
    });

    it('rejects an out-of-range page size', async () => {
      await http().get(`/songs/${songId}/comments?limit=101`).expect(400);
    });

    it('rejects a reply to a comment on a different song', async () => {
      await post(userToken, {
        body: 'Lost reply',
        parentCommentId: '000000000000000000000000',
      }).expect(400);
    });

    it('404s for comments on a song that does not exist', async () => {
      await http().get('/songs/999999/comments').expect(404);
    });

    it("forbids deleting someone else's comment", async () => {
      await http()
        .delete(`/comments/${rootId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('lets the author delete their own comment', async () => {
      await http()
        .delete(`/comments/${rootId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(204);
    });

    it("lets an admin delete anyone's comment", async () => {
      const created = await post(otherToken, { body: 'Mine' }).expect(201);
      othersId = (created.body as { _id: string })._id;

      await http()
        .delete(`/comments/${othersId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
      await http()
        .delete(`/comments/${othersId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
