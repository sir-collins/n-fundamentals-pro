import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { AUTH_ATTEMPTS_PER_MINUTE } from './../src/auth/auth-throttle';

// Throttling is skipped under NODE_ENV=test (every E2E request shares one
// IP). This suite swaps in the same limits without the skip.
describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  const credentials = {
    email: `e2e-${Date.now()}-nobody@example.com`,
    password: 'wrong-password',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getOptionsToken())
      .useValue({ throttlers: [{ ttl: 60_000, limit: 100 }] })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks REST login after too many attempts', async () => {
    for (let i = 0; i < AUTH_ATTEMPTS_PER_MINUTE; i++) {
      await http().post('/auth/login').send(credentials).expect(401);
    }

    const res = await http().post('/auth/login').send(credentials).expect(429);

    expect(res.body).toMatchObject({ statusCode: 429, path: '/auth/login' });
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('blocks the GraphQL login mutation too', async () => {
    const query = `mutation { login(input: { email: "${credentials.email}", password: "${credentials.password}" }) { accessToken } }`;
    const attempt = async () => {
      const res = await http().post('/graphql').send({ query }).expect(200);
      return (res.body as { errors: { extensions: { statusCode: number } }[] })
        .errors[0].extensions.statusCode;
    };

    for (let i = 0; i < AUTH_ATTEMPTS_PER_MINUTE; i++) {
      expect(await attempt()).toBe(401);
    }
    expect(await attempt()).toBe(429);
  });

  it('leaves ordinary routes on the generous default limit', async () => {
    for (let i = 0; i < AUTH_ATTEMPTS_PER_MINUTE + 2; i++) {
      await http().get('/songs?limit=1').expect(200);
    }
  });
});
