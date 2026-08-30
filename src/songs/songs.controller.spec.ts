import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { Song } from './entities/song.entity';
import { ArtistsService } from '../artists/artists.service';

describe('SongsController', () => {
  let controller: SongsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SongsController],
      // SongsService depends on a Repository<Song> (@InjectRepository) and
      // ArtistsService — plain objects stand in since this smoke test
      // never actually calls either.
      providers: [
        SongsService,
        { provide: getRepositoryToken(Song), useValue: {} },
        { provide: ArtistsService, useValue: {} },
      ],
    }).compile();

    controller = module.get<SongsController>(SongsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
