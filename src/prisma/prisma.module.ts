import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Provides one shared `PrismaService` (one connection pool) to any module
 * that imports this — the Prisma counterpart to `TypeOrmModule.forRoot`.
 */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
