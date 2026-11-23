import { describe, expect, it, jest } from '@jest/globals';
import type { Response } from 'express';
import type { Connection } from 'mongoose';
import type { DataSource } from 'typeorm';
import type { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

function setup({ postgresUp = true } = {}) {
  const dataSource = {
    query: postgresUp
      ? jest.fn(() => Promise.resolve([]))
      : jest.fn(() => Promise.reject(new Error('refused'))),
  } as unknown as DataSource;
  const prisma = {
    $queryRaw: jest.fn(() => Promise.resolve([])),
  } as unknown as PrismaService;
  const mongo = {
    db: { admin: () => ({ ping: () => Promise.resolve({ ok: 1 }) }) },
  } as unknown as Connection;
  const res = { status: jest.fn() } as unknown as Response;

  return { controller: new HealthController(dataSource, prisma, mongo), res };
}

describe('HealthController', () => {
  it('returns ok with 200 when every datastore answers', async () => {
    const { controller, res } = setup();

    await expect(controller.check(res)).resolves.toEqual({
      status: 'ok',
      checks: { postgres: 'up', prisma: 'up', mongodb: 'up' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 503 and names the datastore that is down', async () => {
    const { controller, res } = setup({ postgresUp: false });

    await expect(controller.check(res)).resolves.toEqual({
      status: 'error',
      checks: { postgres: 'down', prisma: 'up', mongodb: 'up' },
    });
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
