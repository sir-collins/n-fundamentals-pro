import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaSongsService } from './prisma-songs.service';

type Query = (args?: unknown) => Promise<unknown>;

// A hand-built stand-in for the `song` delegate rather than createMock:
// Prisma's generated method types (PrismaPromise, deep generics) make
// typed mockResolvedValue calls noisy for no gain. What's under test is
// the query each method *sends* — exactly what TypeORM's mocks hide.
function songDelegate() {
  return {
    create: jest.fn<Query>(),
    findMany: jest.fn<Query>(),
    count: jest.fn<Query>(),
    findUnique: jest.fn<Query>(),
    update: jest.fn<Query>(),
    delete: jest.fn<Query>(),
  };
}

const notFound = () =>
  new Prisma.PrismaClientKnownRequestError('No record was found', {
    code: 'P2025',
    clientVersion: '7.10.0',
  });

describe('PrismaSongsService', () => {
  let service: PrismaSongsService;
  let song: ReturnType<typeof songDelegate>;

  beforeEach(() => {
    song = songDelegate();
    service = new PrismaSongsService({ song } as unknown as PrismaService);
  });

  const dto = {
    title: 'Blinding Lights',
    artists: ['The Weeknd', 'Daft Punk', 'The Weeknd'],
    releaseDate: '2019-11-29',
    duration: '03:20',
  };
  const expectedArtists = [
    { where: { name: 'The Weeknd' }, create: { name: 'The Weeknd' } },
    { where: { name: 'Daft Punk' }, create: { name: 'Daft Punk' } },
  ];

  describe('create', () => {
    it('connects-or-creates each unique artist in the same query', async () => {
      const created = { id: 1 };
      song.create.mockResolvedValue(created);

      expect(await service.create(dto)).toBe(created);
      expect(song.create).toHaveBeenCalledWith({
        data: {
          title: dto.title,
          releaseDate: dto.releaseDate,
          duration: dto.duration,
          artists: { connectOrCreate: expectedArtists },
        },
        include: { artists: true },
      });
    });
  });

  describe('findAll', () => {
    it('fetches one ordered page and the total', async () => {
      const data = [{ id: 11 }];
      song.findMany.mockResolvedValue(data);
      song.count.mockResolvedValue(25);

      expect(await service.findAll({ page: 2, limit: 10 })).toEqual({
        data,
        total: 25,
      });
      expect(song.findMany).toHaveBeenCalledWith({
        include: { artists: true },
        orderBy: { id: 'asc' },
        skip: 10,
        take: 10,
      });
    });
  });

  describe('findOne', () => {
    it('returns null when no song has the id', async () => {
      song.findUnique.mockResolvedValue(null);

      expect(await service.findOne(999)).toBeNull();
      expect(song.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        include: { artists: true },
      });
    });
  });

  describe('update', () => {
    it('replaces the artists: clears the links, then connects-or-creates', async () => {
      song.update.mockResolvedValue({ id: 1 });

      await service.update(1, { artists: dto.artists });

      expect(song.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { artists: { set: [], connectOrCreate: expectedArtists } },
        include: { artists: true },
      });
    });

    it('leaves the artists alone when none are supplied', async () => {
      song.update.mockResolvedValue({ id: 1 });

      await service.update(1, { duration: '04:00' });

      expect(song.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { duration: '04:00' },
        include: { artists: true },
      });
    });

    it('returns null when Prisma reports the row missing (P2025)', async () => {
      song.update.mockRejectedValue(notFound());

      expect(await service.update(999, { title: 'x' })).toBeNull();
    });

    it('rethrows any other error', async () => {
      song.update.mockRejectedValue(new Error('db down'));

      await expect(service.update(1, { title: 'x' })).rejects.toThrow(
        'db down',
      );
    });
  });

  describe('remove', () => {
    it('returns true once the song is deleted', async () => {
      song.delete.mockResolvedValue({ id: 1 });

      expect(await service.remove(1)).toBe(true);
      expect(song.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('returns false when Prisma reports the row missing (P2025)', async () => {
      song.delete.mockRejectedValue(notFound());

      expect(await service.remove(999)).toBe(false);
    });

    it('rethrows any other error', async () => {
      song.delete.mockRejectedValue(new Error('db down'));

      await expect(service.remove(1)).rejects.toThrow('db down');
    });
  });
});
