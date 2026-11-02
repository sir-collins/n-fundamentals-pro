import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaRelationsService } from './prisma-relations.service';

type Query = (args?: unknown) => Promise<unknown>;

// Hand-built delegates, as in prisma-songs.service.spec.ts: what's under
// test is the query each method sends.
function delegates() {
  return {
    artist: { findUnique: jest.fn<Query>(), deleteMany: jest.fn<Query>() },
    album: { create: jest.fn<Query>(), createManyAndReturn: jest.fn<Query>() },
    lyrics: { findUnique: jest.fn<Query>(), upsert: jest.fn<Query>() },
    song: { updateMany: jest.fn<Query>() },
  };
}

// What a nested `connect` to a missing record throws (checked against
// the real database while building this step).
const notFound = () =>
  new Prisma.PrismaClientKnownRequestError('No record was found', {
    code: 'P2025',
    clientVersion: '7.10.0',
  });

describe('PrismaRelationsService', () => {
  let service: PrismaRelationsService;
  let prisma: ReturnType<typeof delegates>;

  beforeEach(() => {
    prisma = delegates();
    service = new PrismaRelationsService(prisma as unknown as PrismaService);
  });

  const album = { title: 'After Hours', releaseDate: '2020-03-20' };

  describe('findArtist', () => {
    it('loads albums in order and counts songs, in one query', async () => {
      const artist = { id: 1 };
      prisma.artist.findUnique.mockResolvedValue(artist);

      expect(await service.findArtist(1)).toBe(artist);
      expect(prisma.artist.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          albums: { orderBy: { id: 'asc' } },
          _count: { select: { songs: true } },
        },
      });
    });
  });

  describe('addAlbum', () => {
    it('connects the album to its artist', async () => {
      const created = { id: 5 };
      prisma.album.create.mockResolvedValue(created);

      expect(await service.addAlbum(1, album)).toBe(created);
      expect(prisma.album.create).toHaveBeenCalledWith({
        data: { ...album, artist: { connect: { id: 1 } } },
      });
    });

    it('returns null when the artist is missing (P2025)', async () => {
      prisma.album.create.mockRejectedValue(notFound());

      expect(await service.addAlbum(999, album)).toBeNull();
    });

    it('rethrows any other error', async () => {
      prisma.album.create.mockRejectedValue(new Error('db down'));

      await expect(service.addAlbum(1, album)).rejects.toThrow('db down');
    });
  });

  describe('findLyrics', () => {
    it('looks the lyrics up by their unique songId', async () => {
      prisma.lyrics.findUnique.mockResolvedValue(null);

      expect(await service.findLyrics(7)).toBeNull();
      expect(prisma.lyrics.findUnique).toHaveBeenCalledWith({
        where: { songId: 7 },
      });
    });
  });

  describe('upsertLyrics', () => {
    it('creates them connected to the song, or replaces the text', async () => {
      const saved = { id: 3 };
      prisma.lyrics.upsert.mockResolvedValue(saved);

      expect(await service.upsertLyrics(7, { text: 'la la' })).toBe(saved);
      expect(prisma.lyrics.upsert).toHaveBeenCalledWith({
        where: { songId: 7 },
        create: { text: 'la la', song: { connect: { id: 7 } } },
        update: { text: 'la la' },
      });
    });

    it('returns null when the song is missing (P2025)', async () => {
      prisma.lyrics.upsert.mockRejectedValue(notFound());

      expect(await service.upsertLyrics(999, { text: 'x' })).toBeNull();
    });

    it('rethrows any other error', async () => {
      prisma.lyrics.upsert.mockRejectedValue(new Error('db down'));

      await expect(service.upsertLyrics(7, { text: 'x' })).rejects.toThrow(
        'db down',
      );
    });
  });

  describe('addAlbums', () => {
    const albums = [album, { title: 'Starboy', releaseDate: '2016-11-25' }];

    it('inserts them all under the artist in one call, skipping duplicates', async () => {
      const created = [{ id: 5 }];
      prisma.artist.findUnique.mockResolvedValue({ id: 1 });
      prisma.album.createManyAndReturn.mockResolvedValue(created);

      expect(await service.addAlbums(1, albums)).toBe(created);
      expect(prisma.artist.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true },
      });
      expect(prisma.album.createManyAndReturn).toHaveBeenCalledWith({
        data: [
          { ...album, artistId: 1 },
          { title: 'Starboy', releaseDate: '2016-11-25', artistId: 1 },
        ],
        skipDuplicates: true,
      });
    });

    it('returns null without inserting when the artist is missing', async () => {
      prisma.artist.findUnique.mockResolvedValue(null);

      expect(await service.addAlbums(999, albums)).toBeNull();
      expect(prisma.album.createManyAndReturn).not.toHaveBeenCalled();
    });
  });

  describe('updateSongs', () => {
    it('sends one updateMany over the unique ids, picked fields only', async () => {
      prisma.song.updateMany.mockResolvedValue({ count: 2 });

      // An unvalidated extra field, as the global pipe would let through.
      const body = { ids: [1, 2, 2], duration: '04:00', title: 'all the same' };

      expect(await service.updateSongs(body)).toEqual({ count: 2 });
      expect(prisma.song.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
        data: { releaseDate: undefined, duration: '04:00' },
      });
    });
  });

  describe('deleteOrphanArtists', () => {
    it('deletes only artists with no songs and no albums', async () => {
      prisma.artist.deleteMany.mockResolvedValue({ count: 3 });

      expect(await service.deleteOrphanArtists()).toEqual({ count: 3 });
      expect(prisma.artist.deleteMany).toHaveBeenCalledWith({
        where: { songs: { none: {} }, albums: { none: {} } },
      });
    });
  });
});
