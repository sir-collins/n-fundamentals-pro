import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { expect, it, describe, beforeEach } from '@jest/globals';
import { SongsService } from './songs.service';
import { Song } from './entities/song.entity';

describe('SongsService', () => {
  let service: SongsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      // SongsService now depends on a Repository<Song> (@InjectRepository)
      // instead of nothing — a plain object stands in since this smoke
      // test never actually calls a repository method.
      providers: [
        SongsService,
        { provide: getRepositoryToken(Song), useValue: {} },
      ],
    }).compile();

    service = module.get<SongsService>(SongsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
