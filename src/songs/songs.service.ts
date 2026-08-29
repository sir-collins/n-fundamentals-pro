import { Injectable } from '@nestjs/common';

@Injectable()
export class SongsService {
  private songs: string[] = [];

  create(song: string): string[] {
    this.songs.push(song);
    return this.songs;
  }

  findAll(): string[] {
    return this.songs;
  }
}
