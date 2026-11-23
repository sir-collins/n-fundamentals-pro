import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ArtistsService } from './artists.service';

/** The job's name in `SchedulerRegistry`. */
export const ORPHAN_ARTISTS_CLEANUP = 'orphan-artists-cleanup';

/**
 * Deletes orphaned artists (on no song) every night at 03:00 UTC. TypeORM
 * only; the Prisma side has its own `DELETE /prisma/artists/orphans`.
 *
 * `timeZone: 'UTC'` makes "3 AM" the same locally and on Railway. No
 * try/catch: `@nestjs/schedule` logs errors thrown by a job.
 *
 * Accepted caveats: every app instance runs the job (a repeat finds
 * nothing), and a song saved with an artist at the moment it is deleted
 * could fail.
 */
@Injectable()
export class OrphanArtistsCleanupJob {
  private readonly logger = new Logger(OrphanArtistsCleanupJob.name);

  constructor(private readonly artistsService: ArtistsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: ORPHAN_ARTISTS_CLEANUP,
    timeZone: 'UTC',
  })
  async handleCleanup(): Promise<void> {
    const deleted = await this.artistsService.deleteOrphans();
    this.logger.log(`Deleted ${deleted} orphaned artist(s)`);
  }
}
