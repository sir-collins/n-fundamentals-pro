import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Connection } from 'mongoose';
import { DataSource } from 'typeorm';
import { PrismaService } from '../prisma/prisma.service';

type CheckStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'error';
  checks: Record<'postgres' | 'prisma' | 'mongodb', CheckStatus>;
}

const CHECK_TIMEOUT_MS = 3000;

/**
 * Readiness probe: pings every datastore the API depends on.
 *
 * Hand-rolled rather than `@nestjs/terminus`: Terminus 12 uses
 * `import.meta`, which the CommonJS Jest setup can't load, and three pings
 * don't need a framework.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly prisma: PrismaService,
    @InjectConnection() private readonly mongo: Connection,
  ) {}

  /** 200 when every datastore answers, 503 (same body) otherwise. */
  @ApiOperation({ summary: 'Check that every datastore is reachable.' })
  @ApiResponse({ status: 200, description: 'All datastores are up.' })
  @ApiResponse({ status: 503, description: 'At least one is down.' })
  @Get()
  async check(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthReport> {
    const [postgres, prisma, mongodb] = await Promise.all([
      ping(() => this.dataSource.query('SELECT 1')),
      ping(() => this.prisma.$queryRaw`SELECT 1`),
      ping(async () => {
        if (!this.mongo.db) throw new Error('MongoDB is not connected');
        await this.mongo.db.admin().ping();
      }),
    ]);

    const checks = { postgres, prisma, mongodb };
    const healthy = Object.values(checks).every((check) => check === 'up');

    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: healthy ? 'ok' : 'error', checks };
  }
}

async function ping(probe: () => Promise<unknown>): Promise<CheckStatus> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timed out')), CHECK_TIMEOUT_MS);
  });

  try {
    await Promise.race([probe(), timeout]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}
