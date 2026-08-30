import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSongDto } from './dto/create-song-dto';
import { Song } from './entities/song.entity';

/** Backed by Postgres via TypeORM's `Repository<Song>`. */
@Injectable()
export class SongsService {
  constructor(
    @InjectRepository(Song)
    private readonly songsRepository: Repository<Song>,
  ) {}

  /** Create a song; Postgres assigns the id. */
  create(createSongDto: CreateSongDto): Promise<Song> {
    const song = this.songsRepository.create(createSongDto);
    return this.songsRepository.save(song);
  }

  /** List all songs. */
  findAll(): Promise<Song[]> {
    return this.songsRepository.find();
  }

  /** Find a song by id, or `null` if none exists. */
  findOne(id: number): Promise<Song | null> {
    return this.songsRepository.findOneBy({ id });
  }

  /**
   * Merge the given fields onto the song with `id`.
   * @returns the updated song, or `null` if no song exists with `id`.
   */
  async update(
    id: number,
    updateSongDto: Partial<CreateSongDto>,
  ): Promise<Song | null> {
    const song = await this.findOne(id);

    if (!song) {
      return null;
    }

    Object.assign(song, updateSongDto);
    return this.songsRepository.save(song);
  }

  /**
   * Remove the song with `id`.
   * @returns whether a song was found and removed.
   */
  async remove(id: number): Promise<boolean> {
    // delete() issues a DELETE WHERE id = ... directly — no need to fetch
    // the row first. `affected` tells us whether a row actually matched.
    const result = await this.songsRepository.delete(id);
    return result.affected !== 0;
  }
}
