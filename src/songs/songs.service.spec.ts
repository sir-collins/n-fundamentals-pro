import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { expect, it, describe, beforeEach } from '@jest/globals';
import { SongsService } from './songs.service';
import { Song } from './entities/song.entity';
import { ArtistsService } from '../artists/artists.service';

describe('SongsService', () => {
  let service: SongsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      // SongsService depends on a Repository<Song> (@InjectRepository) and
      // ArtistsService — plain objects stand in since this smoke test
      // never actually calls either.
      providers: [
        SongsService,
        { provide: getRepositoryToken(Song), useValue: {} },
        { provide: ArtistsService, useValue: {} },
      ],
    }).compile();

    service = module.get<SongsService>(SongsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
