import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song-dto';

@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createSongDto: CreateSongDto) {
    try {
      return this.songsService.create(createSongDto);
    } catch {
      throw new InternalServerErrorException('Failed to create song');
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(): CreateSongDto[] {
    try {
      return this.songsService.findAll();
    } catch {
      throw new InternalServerErrorException('Failed to fetch songs');
    }
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string) {
    try {
      const song = this.songsService
        .findAll()
        .find((item) => item.title === id);

      if (!song) {
        throw new NotFoundException(`Song with id ${id} was not found`);
      }

      return song;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to fetch song');
    }
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: string,
    @Body() body: Partial<CreateSongDto>,
  ): string {
    try {
      if (!body || Object.keys(body).length === 0) {
        throw new BadRequestException('Song update payload is required');
      }

      const songExists = this.songsService
        .findAll()
        .some((item) => item.title === id);

      if (!songExists) {
        throw new NotFoundException(`Song with id: ${id} was not found`);
      }

      return `This action updates a song endpoint for ${id}`;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to update song');
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string): void {
    try {
      const songExists = this.songsService
        .findAll()
        .some((item) => item.title === id);

      if (!songExists) {
        throw new NotFoundException(`Song with id: ${id} was not found`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to delete song');
    }
  }
}
