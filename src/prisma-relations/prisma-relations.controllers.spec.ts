import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Album, Lyrics } from '../generated/prisma/client';
import { PrismaArtistsController } from './prisma-artists.controller';
import { PrismaLyricsController } from './prisma-lyrics.controller';
import {
  ArtistDetail,
  PrismaRelationsService,
} from './prisma-relations.service';

// Both controllers share one service, so one spec: each translation once —
// service null → 404, unexpected failure → 500.
describe('Prisma relations controllers', () => {
  let artists: PrismaArtistsController;
  let lyrics: PrismaLyricsController;
  let service: DeepMocked<PrismaRelationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrismaArtistsController, PrismaLyricsController],
      providers: [
        {
          provide: PrismaRelationsService,
          useValue: createMock<PrismaRelationsService>(),
        },
      ],
    }).compile();

    artists = module.get(PrismaArtistsController);
    lyrics = module.get(PrismaLyricsController);
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
});
