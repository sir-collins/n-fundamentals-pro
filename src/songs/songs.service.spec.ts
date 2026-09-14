import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { SongsService } from './songs.service';
import { Song } from './entities/song.entity';
import { Artist } from '../artists/entities/artist.entity';
import { ArtistsService } from '../artists/artists.service';

describe('SongsService', () => {
  let service: SongsService;
  let repository: DeepMocked<Repository<Song>>;
  let artistsService: DeepMocked<ArtistsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SongsService,
        {
          provide: getRepositoryToken(Song),
          useValue: createMock<Repository<Song>>(),
        },
        { provide: ArtistsService, useValue: createMock<ArtistsService>() },
      ],
    }).compile();

    service = module.get<SongsService>(SongsService);
    repository = module.get(getRepositoryToken(Song));
    artistsService = module.get(ArtistsService);
  });

  describe('create', () => {
    it('resolves artist names before saving, and returns the saved song', async () => {
      const artists = [{ id: 1, name: 'The Weeknd' }] as Artist[];
      const createdSong = { title: 'Blinding Lights', artists } as Song;
      const savedSong = { ...createdSong, id: 1 };

      artistsService.findOrCreateMany.mockResolvedValue(artists);
      repository.create.mockReturnValue(createdSong);
      repository.save.mockResolvedValue(savedSong);

      const dto = {
        title: 'Blinding Lights',
        artists: ['The Weeknd'],
        releaseDate: '2019-11-29',
        duration: '00:03',
      };
      const result = await service.create(dto);

      expect(artistsService.findOrCreateMany).toHaveBeenCalledWith([
        'The Weeknd',
      ]);
      expect(repository.create).toHaveBeenCalledWith({ ...dto, artists });
      expect(repository.save).toHaveBeenCalledWith(createdSong);
      expect(result).toBe(savedSong);
    });
  });

  describe('findAll', () => {
    it('paginates via skip/take and populates artists', async () => {
      const songs = [{ id: 1 } as Song];
      repository.findAndCount.mockResolvedValue([songs, 1]);

      const result = await service.findAll({ page: 2, limit: 5 });

      expect(repository.findAndCount).toHaveBeenCalledWith({
        relations: { artists: true },
        skip: 5, // (page 2 - 1) * limit 5
        take: 5,
      });
      expect(result).toEqual({ data: songs, total: 1 });
    });
  });

  describe('findOne', () => {
    it('queries by id with artists populated', async () => {
      const song = { id: 1 } as Song;
      repository.findOne.mockResolvedValue(song);

      const result = await service.findOne(1);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { artists: true },
      });
      expect(result).toBe(song);
    });

    it('returns null when no song exists with that id', async () => {
      repository.findOne.mockResolvedValue(null);

      expect(await service.findOne(999)).toBeNull();
    });
  });

  describe('update', () => {
    it('returns null without saving when the song does not exist', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      const result = await service.update(1, { title: 'New Title' });

      expect(result).toBeNull();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('merges fields and saves, without touching artists when none are supplied', async () => {
      // Deliberately partial (missing releaseDate/duration) — a plain
      // `as Song` wouldn't type-check, hence the `unknown` detour.
      const existing = {
        id: 1,
        title: 'Old Title',
        artists: [],
      } as unknown as Song;
      jest.spyOn(service, 'findOne').mockResolvedValue(existing);
      repository.save.mockResolvedValue(existing);

      await service.update(1, { title: 'New Title' });

      expect(artistsService.findOrCreateMany).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, title: 'New Title' }),
      );
    });

    it('resolves and replaces artists when artist names are supplied', async () => {
      const existing = {
        id: 1,
        title: 'Old Title',
        artists: [],
      } as unknown as Song;
      const newArtists = [{ id: 2, name: 'New Artist' }] as Artist[];
      jest.spyOn(service, 'findOne').mockResolvedValue(existing);
      artistsService.findOrCreateMany.mockResolvedValue(newArtists);
      repository.save.mockResolvedValue(existing);

      await service.update(1, { artists: ['New Artist'] });

      expect(artistsService.findOrCreateMany).toHaveBeenCalledWith([
        'New Artist',
      ]);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ artists: newArtists }),
      );
    });
  });

  describe('remove', () => {
    it('returns true when a row was actually deleted', async () => {
      repository.delete.mockResolvedValue({ affected: 1, raw: [] });

      expect(await service.remove(1)).toBe(true);
      expect(repository.delete).toHaveBeenCalledWith(1);
    });

    it('returns false when no row matched', async () => {
      repository.delete.mockResolvedValue({ affected: 0, raw: [] });

      expect(await service.remove(999)).toBe(false);
    });
  });
});
