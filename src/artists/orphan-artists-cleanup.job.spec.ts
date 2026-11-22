import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { Logger } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { OrphanArtistsCleanupJob } from './orphan-artists-cleanup.job';
import { ArtistsService } from './artists.service';

describe('OrphanArtistsCleanupJob', () => {
  let job: OrphanArtistsCleanupJob;
  let artistsService: DeepMocked<ArtistsService>;

  beforeEach(() => {
    artistsService = createMock<ArtistsService>();
    job = new OrphanArtistsCleanupJob(artistsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deletes orphans and logs how many', async () => {
    artistsService.deleteOrphans.mockResolvedValue(3);
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await job.handleCleanup();

    expect(artistsService.deleteOrphans).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Deleted 3 orphaned artist(s)');
  });

  // The job doesn't catch: @nestjs/schedule's wrapper logs the error.
  it('lets a failure propagate to the scheduler wrapper', async () => {
    artistsService.deleteOrphans.mockRejectedValue(new Error('db down'));

    await expect(job.handleCleanup()).rejects.toThrow('db down');
  });
});
