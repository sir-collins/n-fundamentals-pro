import { Injectable } from '@nestjs/common';
import { CreateSongDto } from './dto/create-song-dto';
import { Song } from './entities/song.entity';

/**
 * In-memory store for songs. Stands in for a real database until Project 2
 * (see docs/00-roadmap.md) swaps this out for TypeORM.
 */
@Injectable()
export class SongsService {
  private songs: Song[] = [];
  private nextId = 1;

  /** Create a song, assigning it the next available id. */
  create(createSongDto: CreateSongDto): Song {
    const song: Song = { id: this.nextId++, ...createSongDto };
    this.songs.push(song);
    return song;
  }

  /** List all songs. */
  findAll(): Song[] {
    return this.songs;
  }

  /** Find a song by id, or `undefined` if none exists. */
  findOne(id: number): Song | undefined {
    return this.songs.find((song) => song.id === id);
  }

  /**
   * Merge the given fields onto the song with `id`.
   * @returns the updated song, or `undefined` if no song exists with `id`.
   */
  update(id: number, updateSongDto: Partial<CreateSongDto>): Song | undefined {
    const song = this.findOne(id);

    if (!song) {
      return undefined;
    }

    // Mutate the found record in place rather than replacing it, so the
    // returned object is the same instance callers already hold.
    Object.assign(song, updateSongDto);
    return song;
  }

  /**
   * Remove the song with `id`.
   * @returns whether a song was found and removed.
   */
  remove(id: number): boolean {
    // findIndex + splice instead of filter — filter would silently no-op on
    // an unknown id, and callers need to know whether anything was removed.
    const index = this.songs.findIndex((song) => song.id === id);

    if (index === -1) {
      return false;
    }

    this.songs.splice(index, 1);
    return true;
  }
}
