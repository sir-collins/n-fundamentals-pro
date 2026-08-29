import { Injectable } from '@nestjs/common';
import { CreateSongDto } from './dto/create-song-dto';
import { Song } from './entities/song.entity';

@Injectable()
export class SongsService {
  private songs: Song[] = [];
  private nextId = 1;

  create(createSongDto: CreateSongDto): Song {
    const song: Song = { id: this.nextId++, ...createSongDto };
    this.songs.push(song);
    return song;
  }

  findAll(): Song[] {
    return this.songs;
  }

  findOne(id: number): Song | undefined {
    return this.songs.find((song) => song.id === id);
  }

  update(id: number, updateSongDto: Partial<CreateSongDto>): Song | undefined {
    const song = this.findOne(id);

    if (!song) {
      return undefined;
    }

    Object.assign(song, updateSongDto);
    return song;
  }

  remove(id: number): boolean {
    const index = this.songs.findIndex((song) => song.id === id);

    if (index === -1) {
      return false;
    }

    this.songs.splice(index, 1);
    return true;
  }
}
