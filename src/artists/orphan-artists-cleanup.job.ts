import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ArtistsService } from './artists.service';

/** The job's name in `SchedulerRegistry`. */
export const ORPHAN_ARTISTS_CLEANUP = 'orphan-artists-cleanup';

/**
 * Deletes orphaned artists (on no song) every night at 03:00 UTC. TypeORM
 * side only: the Prisma stack has its own on-demand
 * `DELETE /prisma/artists/orphans`, and the two are kept separate.
 *
 * `timeZone: 'UTC'` makes "3 AM" mean the same time locally and on Railway.
 * No try/catch on purpose: `@nestjs/schedule` wraps every job and logs a
 * thrown error under the `Scheduler` context.
 *
 * Caveats, accepted: every running instance of the app runs this job (fine
 * here, since one instance runs and a repeat finds nothing to delete). A
 * song saved with an artist at the moment that artist is deleted as an
 * orphan could fail; unlikely at 3 AM.
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
