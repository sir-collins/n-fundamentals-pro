import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaSongsController } from './prisma-songs.controller';
import { PrismaSongsService, SongWithArtists } from './prisma-songs.service';

// Smaller than songs.controller.spec.ts on purpose: the handlers are the
// same shape, so this covers each translation once — service null/false
// → 404, empty body → 400, unexpected failure → 500.
describe('PrismaSongsController', () => {
  let controller: PrismaSongsController;
  let songsService: DeepMocked<PrismaSongsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrismaSongsController],
      providers: [
        {
          provide: PrismaSongsService,
          useValue: createMock<PrismaSongsService>(),
        },
      ],
    }).compile();

    controller = module.get(PrismaSongsController);
    songsService = module.get(PrismaSongsService);
  });

  it('returns the song when the service finds one', async () => {
    const song = { id: 1 } as SongWithArtists;
    songsService.findOne.mockResolvedValue(song);

    expect(await controller.findOne(1)).toBe(song);
  });

  it('turns a missing song into a 404', async () => {
    songsService.findOne.mockResolvedValue(null);

    await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('wraps an unexpected failure as a 500, not a 404', async () => {
    songsService.findOne.mockRejectedValue(new Error('db down'));

    await expect(controller.findOne(1)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('rejects an empty update without calling the service', async () => {
    await expect(controller.update(1, {})).rejects.toThrow(BadRequestException);
    expect(songsService.update).not.toHaveBeenCalled();
  });

  it('turns an update of a missing song into a 404', async () => {
    songsService.update.mockResolvedValue(null);

    await expect(controller.update(999, { title: 'x' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('turns a delete of a missing song into a 404', async () => {
    songsService.remove.mockResolvedValue(false);

    await expect(controller.delete(999)).rejects.toThrow(NotFoundException);
  });

  it('resolves cleanly when the song was deleted', async () => {
    songsService.remove.mockResolvedValue(true);

    await expect(controller.delete(1)).resolves.toBeUndefined();
  });
});
