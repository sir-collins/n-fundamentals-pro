import { Injectable } from '@nestjs/common';
import { CreateSongDto } from './dto/create-song-dto';

@Injectable()
export class SongsService {
  private songs: CreateSongDto[] = [];

  create(song: CreateSongDto): CreateSongDto[] {
    this.songs.push(song);
    return this.songs;
  }

  findAll(): CreateSongDto[] {
    return this.songs;
  }
}
