import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Shares one `PrismaService` (one connection pool); the Prisma counterpart
 * to `TypeOrmModule.forRoot`.
 */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
