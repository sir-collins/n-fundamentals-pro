import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { Song } from './entities/song.entity';

describe('SongsController', () => {
  let controller: SongsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SongsController],
      // SongsService now depends on a Repository<Song> (@InjectRepository)
      // instead of nothing — a plain object stands in since this smoke
      // test never actually calls a repository method.
      providers: [
        SongsService,
        { provide: getRepositoryToken(Song), useValue: {} },
      ],
    }).compile();

    controller = module.get<SongsController>(SongsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
