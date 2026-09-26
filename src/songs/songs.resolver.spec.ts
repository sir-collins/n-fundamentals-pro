import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { SongsResolver } from './songs.resolver';
import { SongsService } from './songs.service';
import { Song } from './entities/song.entity';

// Calls resolver methods directly, so `@UseGuards(...)` on the mutations
// never runs here — guards, arg coercion and GraphQL error formatting are
// the E2E suite's job, not this one's.
describe('SongsResolver', () => {
  let resolver: SongsResolver;
  let songsService: DeepMocked<SongsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SongsResolver,
        { provide: SongsService, useValue: createMock<SongsService>() },
      ],
    }).compile();

    resolver = module.get<SongsResolver>(SongsResolver);
    songsService = module.get(SongsService);
  });

  const input = {
    title: 'Blinding Lights',
    artists: ['The Weeknd'],
    releaseDate: '2019-11-29',
    duration: '00:03',
  };

  describe('songs', () => {
    it('returns the paginated result from the service', async () => {
      const page = { data: [], total: 0 };
      songsService.findAll.mockResolvedValue(page);

      expect(await resolver.songs({ page: 2, limit: 5 })).toBe(page);
      expect(songsService.findAll).toHaveBeenCalledWith({ page: 2, limit: 5 });
    });
  });

  describe('song', () => {
    it('returns the song when the service finds one', async () => {
      const song = { id: 1 } as Song;
      songsService.findOne.mockResolvedValue(song);

      expect(await resolver.song(1)).toBe(song);
    });

    it('throws NotFoundException when the service returns null', async () => {
      songsService.findOne.mockResolvedValue(null);

      await expect(resolver.song(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createSong', () => {
    it('returns the created song', async () => {
      const song = { id: 1 } as Song;
      songsService.create.mockResolvedValue(song);

      expect(await resolver.createSong(input)).toBe(song);
      expect(songsService.create).toHaveBeenCalledWith(input);
    });
  });

  describe('updateSong', () => {
    it('returns the updated song', async () => {
      const song = { id: 1, title: 'New Title' } as Song;
      songsService.update.mockResolvedValue(song);

      expect(await resolver.updateSong(1, { title: 'New Title' })).toBe(song);
      expect(songsService.update).toHaveBeenCalledWith(1, {
        title: 'New Title',
      });
    });

    it('throws NotFoundException when the service returns null', async () => {
      songsService.update.mockResolvedValue(null);

      await expect(
        resolver.updateSong(999, { title: 'New Title' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteSong', () => {
    it('returns true when the service removed a song', async () => {
      songsService.remove.mockResolvedValue(true);

      expect(await resolver.deleteSong(1)).toBe(true);
    });

    it('throws NotFoundException when the service found nothing to remove', async () => {
      songsService.remove.mockResolvedValue(false);

      await expect(resolver.deleteSong(999)).rejects.toThrow(NotFoundException);
    });
  });
});
