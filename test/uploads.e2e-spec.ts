import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { App } from 'supertest/types';
import { In, Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { User } from './../src/users/entities/user.entity';
import { MAX_AVATAR_BYTES } from './../src/users/users.controller';
import { AvatarStorageService } from './../src/users/avatar-storage.service';
import { ConfigService } from '@nestjs/config';

interface RestError {
  statusCode: number;
  message: string | string[];
}

// A real 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

// Avatar uploads against the real app and Postgres. Storage points at a
// fresh temp directory so the test can inspect exactly what lands on disk
// and never touches ./uploads. That's done by overriding the storage
// provider, not by setting process.env.UPLOADS_DIR: ConfigModule.forRoot()
// reads the environment when AppModule is imported, before beforeAll runs
// (tried first; the files went to ./uploads).
jest.setTimeout(15_000);

describe('Avatar uploads (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  let uploadsDir: string;

  const stamp = Date.now();
  const password = 'password123';
  const ownerEmail = `e2e-${stamp}-avatar-owner@example.com`;
  const plainEmail = `e2e-${stamp}-avatar-none@example.com`;
  let token: string;
  let ownerId: number;
  let plainId: number;

  const http = () => request(app.getHttpServer());
  const avatarFiles = () => readdir(join(uploadsDir, 'avatars'));

  async function signup(email: string): Promise<number> {
    const res = await http()
      .post('/auth/signup')
      .send({ email, password })
      .expect(201);
    return (res.body as { id: number }).id;
  }

  beforeAll(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), 'e2e-uploads-'));
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AvatarStorageService)
      .useValue(
        new AvatarStorageService(
          new ConfigService({ UPLOADS_DIR: uploadsDir }),
        ),
      )
      .compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0);
    users = app.get(getRepositoryToken(User));

    ownerId = await signup(ownerEmail);
    plainId = await signup(plainEmail);
    const login = await http()
      .post('/auth/login')
      .send({ email: ownerEmail, password })
      .expect(200);
    token = (login.body as { access_token: string }).access_token;
  });

  afterAll(async () => {
    await users.delete({ email: In([ownerEmail, plainEmail]) });
    await app.close();
    await rm(uploadsDir, { recursive: true, force: true });
  });

  it('requires a token to upload', async () => {
    await http()
      .put('/users/me/avatar')
      .attach('avatar', PNG, 'me.png')
      .expect(401);
  });

  it('rejects a request with no file', async () => {
    const res = await http()
      .put('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect((res.body as RestError).message).toContain('File is required');
  });

  it('rejects text that claims to be a PNG', async () => {
    const res = await http()
      .put('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('<?php system($_GET["c"]); ?>'), {
        filename: 'cat.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect((res.body as RestError).message).toBe(
      'File must be a PNG, JPEG or WebP image',
    );
  });

  it('rejects a file over 2 MB before buffering it all', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_AVATAR_BYTES)]);

    await http()
      .put('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', big, 'big.png')
      .expect(413);
  });

  it('stores a real PNG and serves the same bytes back', async () => {
    const res = await http()
      .put('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', PNG, { filename: '../../evil.png' })
      .expect(200);
    expect(res.body).toEqual({ avatarUrl: `/users/${ownerId}/avatar` });

    // Server-chosen name, not the client's.
    const files = await avatarFiles();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(new RegExp(`^${ownerId}-[0-9a-f-]{36}\\.png$`));

    const image = await http()
      .get(`/users/${ownerId}/avatar`)
      .buffer(true)
      .parse((r, done) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect((image.body as Buffer).equals(PNG)).toBe(true);
  });

  it('replaces the avatar, deleting the old file', async () => {
    const [before] = await avatarFiles();

    await http()
      .put('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', JPEG, { filename: 'me.png', contentType: 'image/png' })
      .expect(200);

    const after = await avatarFiles();
    expect(after).toHaveLength(1);
    expect(after[0]).not.toBe(before);
    // Extension from the detected bytes, not the claimed type or name.
    expect(after[0]).toMatch(/\.jpg$/);

    const image = await http().get(`/users/${ownerId}/avatar`).expect(200);
    expect(image.headers['content-type']).toBe('image/jpeg');
  });

  it('404s for a user with no avatar', async () => {
    await http().get(`/users/${plainId}/avatar`).expect(404);
  });
});
