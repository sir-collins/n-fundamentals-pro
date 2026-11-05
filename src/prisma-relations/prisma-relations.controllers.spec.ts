import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Album, Lyrics } from '../generated/prisma/client';
import { PrismaArtistsController } from './prisma-artists.controller';
import { PrismaBulkSongsController } from './prisma-bulk-songs.controller';
import { PrismaLyricsController } from './prisma-lyrics.controller';
import {
  ArtistDetail,
  PrismaRelationsService,
  SongTitleConflictError,
} from './prisma-relations.service';
import type { SongWithArtists } from '../prisma-songs/prisma-songs.service';

// Both controllers share one service, so one spec: each translation once —
// service null → 404, unexpected failure → 500.
describe('Prisma relations controllers', () => {
  let artists: PrismaArtistsController;
  let lyrics: PrismaLyricsController;
  let bulkSongs: PrismaBulkSongsController;
  let service: DeepMocked<PrismaRelationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        PrismaArtistsController,
        PrismaLyricsController,
        PrismaBulkSongsController,
      ],
      providers: [
        {
          provide: PrismaRelationsService,
          useValue: createMock<PrismaRelationsService>(),
        },
      ],
    }).compile();

    artists = module.get(PrismaArtistsController);
    lyrics = module.get(PrismaLyricsController);
    bulkSongs = module.get(PrismaBulkSongsController);
    service = module.get(PrismaRelationsService);
  });

  const album = { title: 'After Hours', releaseDate: '2020-03-20' };

  describe('PrismaArtistsController', () => {
    it('returns the artist when the service finds one', async () => {
      const artist = { id: 1 } as ArtistDetail;
      service.findArtist.mockResolvedValue(artist);

      expect(await artists.findOne(1)).toBe(artist);
    });

    it('turns a missing artist into a 404', async () => {
      service.findArtist.mockResolvedValue(null);

      await expect(artists.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('returns the created album', async () => {
      const created = { id: 5 } as Album;
      service.addAlbum.mockResolvedValue(created);

      expect(await artists.addAlbum(1, album)).toBe(created);
    });

    it('turns an album for a missing artist into a 404', async () => {
      service.addAlbum.mockResolvedValue(null);

      await expect(artists.addAlbum(999, album)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('wraps an unexpected failure as a 500', async () => {
      service.addAlbum.mockRejectedValue(new Error('db down'));

      await expect(artists.addAlbum(1, album)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('PrismaLyricsController', () => {
    it('turns a song without lyrics into a 404', async () => {
      service.findLyrics.mockResolvedValue(null);

      await expect(lyrics.findOne(7)).rejects.toThrow(NotFoundException);
    });

    it('returns the saved lyrics', async () => {
      const saved = { id: 3 } as Lyrics;
      service.upsertLyrics.mockResolvedValue(saved);

      expect(await lyrics.upsert(7, { text: 'la la' })).toBe(saved);
    });

    it('turns lyrics for a missing song into a 404', async () => {
      service.upsertLyrics.mockResolvedValue(null);

      await expect(lyrics.upsert(999, { text: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('wraps an unexpected failure as a 500, not a 404', async () => {
      service.findLyrics.mockRejectedValue(new Error('db down'));

      await expect(lyrics.findOne(7)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('bulk operations', () => {
    it('wraps the created albums', async () => {
      const created = [{ id: 5 }] as Album[];
      service.addAlbums.mockResolvedValue(created);

      expect(await artists.addAlbums(1, { albums: [album] })).toEqual({
        created,
      });
    });

    it('turns bulk albums for a missing artist into a 404', async () => {
      service.addAlbums.mockResolvedValue(null);

      await expect(artists.addAlbums(999, { albums: [album] })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('passes the orphan count through', async () => {
      service.deleteOrphanArtists.mockResolvedValue({ count: 2 });

      expect(await artists.deleteOrphans()).toEqual({ count: 2 });
    });

    it('rejects a bulk update with nothing to change, without calling the service', async () => {
      await expect(bulkSongs.updateMany({ ids: [1] })).rejects.toThrow(
        BadRequestException,
      );
      expect(service.updateSongs).not.toHaveBeenCalled();
    });

    it('passes the update count through', async () => {
      service.updateSongs.mockResolvedValue({ count: 2 });

      expect(
        await bulkSongs.updateMany({ ids: [1, 2], duration: '04:00' }),
      ).toEqual({ count: 2 });
    });

    it('wraps an unexpected bulk failure as a 500', async () => {
      service.updateSongs.mockRejectedValue(new Error('db down'));

      await expect(
        bulkSongs.updateMany({ ids: [1], duration: '04:00' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    const imported = {
      title: 'One',
      artists: ['A'],
      releaseDate: '2024-01-15',
      duration: '03:45',
    };

    it('returns the imported songs', async () => {
      const created = [{ id: 1 }] as SongWithArtists[];
      service.importSongs.mockResolvedValue(created);

      expect(await bulkSongs.importSongs({ songs: [imported] })).toBe(created);
      expect(service.importSongs).toHaveBeenCalledWith([imported]);
    });

    it('turns a title conflict into a 409 naming the title', async () => {
      service.importSongs.mockRejectedValue(new SongTitleConflictError('One'));

      await expect(
        bulkSongs.importSongs({ songs: [imported] }),
      ).rejects.toThrow(
        new ConflictException('A song titled "One" already exists'),
      );
    });

    it('wraps an unexpected import failure as a 500', async () => {
      service.importSongs.mockRejectedValue(new Error('db down'));

      await expect(
        bulkSongs.importSongs({ songs: [imported] }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
