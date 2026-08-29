import { Controller, Get, Put, Delete, Post, Body } from '@nestjs/common';
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song-dto';

@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Post()
  create(@Body() createSongDto: CreateSongDto) {
    return this.songsService.create(createSongDto);
  }
  @Get()
  findAll(): string[] {
    return this.songsService.findAll();
  }
  @Get(':id')
  findOne(): string {
    return 'This action returns a single song endpoint';
  }
  @Put(':id')
  update(): string {
    return 'This action updates a song endpoint';
  }
  @Delete(':id')
  delete(): string {
    return 'This action removes a song endpoint';
  }
}
