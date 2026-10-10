import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

// No database here: constructing the client and its pg adapter opens no
// connection — that only happens on $connect, which is spied on. What's
// under test is the wiring: Nest's lifecycle hooks open and close the pool.
describe('PrismaService', () => {
  const config = new ConfigService({
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_USERNAME: 'user',
    DB_PASSWORD: 'secret',
    DB_NAME: 'db',
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('connects when the module starts', async () => {
    const prisma = new PrismaService(config);
    const connect = jest.spyOn(prisma, '$connect').mockResolvedValue(undefined);

    await prisma.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects when the module is destroyed', async () => {
    const prisma = new PrismaService(config);
    const disconnect = jest
      .spyOn(prisma, '$disconnect')
      .mockResolvedValue(undefined);

    await prisma.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
