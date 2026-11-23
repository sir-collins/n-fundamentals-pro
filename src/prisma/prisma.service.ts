import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/** Postgres schema Prisma owns — kept apart from TypeORM's "public". */
export const PRISMA_SCHEMA = 'prisma';

/**
 * The generated Prisma client as an injectable provider.
 *
 * Prisma 7 connects through a driver adapter (`pg`, the same driver TypeORM
 * uses). The adapter, not the URL, carries the schema: `?schema=` is only
 * read by the CLI (prisma.config.ts), so the runtime passes it explicitly.
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

  // Connect eagerly so a bad connection fails the boot, not the first request.
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
