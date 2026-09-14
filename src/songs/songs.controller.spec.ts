import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { Song } from './entities/song.entity';

describe('SongsController', () => {
  let controller: SongsController;
  let songsService: DeepMocked<SongsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SongsController],
      providers: [
        { provide: SongsService, useValue: createMock<SongsService>() },
      ],
    }).compile();

    controller = module.get<SongsController>(SongsController);
    songsService = module.get(SongsService);
  });

  const dto = {
    title: 'Blinding Lights',
    artists: ['The Weeknd'],
    releaseDate: '2019-11-29',
    duration: '00:03',
  };

  describe('create', () => {
    it('returns the created song', async () => {
      const song = { id: 1 } as Song;
      songsService.create.mockResolvedValue(song);

      expect(await controller.create(dto)).toBe(song);
    });

    it('wraps an unexpected service failure as a 500', async () => {
      songsService.create.mockRejectedValue(new Error('db down'));

      await expect(controller.create(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findAll', () => {
    it('returns whatever the service returns', async () => {
      const page = { data: [], total: 0 };
      songsService.findAll.mockResolvedValue(page);

      expect(await controller.findAll({ page: 1, limit: 10 })).toBe(page);
    });

    it('wraps an unexpected service failure as a 500', async () => {
      songsService.findAll.mockRejectedValue(new Error('db down'));

      await expect(controller.findAll({ page: 1, limit: 10 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findOne', () => {
    it('returns the song when the service finds one', async () => {
      const song = { id: 1 } as Song;
      songsService.findOne.mockResolvedValue(song);

      expect(await controller.findOne(1)).toBe(song);
    });

    it('throws NotFoundException when the service returns null', async () => {
      songsService.findOne.mockResolvedValue(null);

      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('wraps an unexpected service failure as a 500, not a 404', async () => {
      songsService.findOne.mockRejectedValue(new Error('db down'));

      await expect(controller.findOne(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('update', () => {
    it('rejects an empty payload without ever calling the service', async () => {
      await expect(controller.update(1, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(songsService.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the service returns null', async () => {
      songsService.update.mockResolvedValue(null);

      await expect(
        controller.update(999, { title: 'New Title' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the updated song', async () => {
      const song = { id: 1, title: 'New Title' } as Song;
      songsService.update.mockResolvedValue(song);

      expect(await controller.update(1, { title: 'New Title' })).toBe(song);
    });
  });

  describe('delete', () => {
    it('throws NotFoundException when the service found nothing to remove', async () => {
      songsService.remove.mockResolvedValue(false);

      await expect(controller.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('resolves cleanly when the song was removed', async () => {
      songsService.remove.mockResolvedValue(true);

      await expect(controller.delete(1)).resolves.toBeUndefined();
    });
  });
});
