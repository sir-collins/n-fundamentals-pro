import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/** Postgres schema Prisma owns — kept apart from TypeORM's "public". */
export const PRISMA_SCHEMA = 'prisma';

/**
 * The generated Prisma client, made injectable. Extending it (rather than
 * wrapping it) means callers use `prisma.song.findMany()` directly, with
 * every generated type intact.
 *
 * Prisma 7 talks to Postgres through a driver adapter — here `pg`, the same
 * driver TypeORM already uses. The adapter, not the URL, carries the schema:
 * `?schema=` in a connection string is a CLI convention (prisma.config.ts),
 * and the adapter takes it as an explicit option instead.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaPg(
        {
          host: configService.getOrThrow<string>('DB_HOST'),
          port: configService.getOrThrow<number>('DB_PORT'),
          user: configService.getOrThrow<string>('DB_USERNAME'),
          password: configService.getOrThrow<string>('DB_PASSWORD'),
          database: configService.getOrThrow<string>('DB_NAME'),
        },
        { schema: PRISMA_SCHEMA },
      ),
    });
  }

  // Connect at startup, so a bad connection fails the boot instead of
  // the first request that happens to need Prisma.
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // Release the pool on shutdown (app.close(), SIGTERM with shutdown
  // hooks), so tests and deploys don't leave connections hanging open.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
