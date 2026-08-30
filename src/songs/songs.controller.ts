import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song-dto';
import { Song } from './entities/song.entity';

/**
 * REST endpoints for the `songs` resource.
 *
 * Every handler follows the same shape: a guard clause throws the specific
 * `HttpException` for a known failure, and the catch block rethrows it
 * as-is (preserving its status) while converting anything unexpected into
 * a generic 500. This keeps expected failures (400/404) distinct from
 * genuine bugs (500) without duplicating that logic per handler.
 *
 * Handlers are `async` because `SongsService` now talks to Postgres —
 * every call is awaited inside the `try` so a rejected query lands in the
 * `catch` block like any other error, instead of escaping as an unhandled
 * rejection.
 */
@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  /** Create a song. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSongDto: CreateSongDto): Promise<Song> {
    try {
      return await this.songsService.create(createSongDto);
    } catch {
      throw new InternalServerErrorException('Failed to create song');
    }
  }

  /** List all songs. */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(): Promise<Song[]> {
    try {
      return await this.songsService.findAll();
    } catch {
      throw new InternalServerErrorException('Failed to fetch songs');
    }
  }

  /**
   * Fetch a single song by id.
   * @throws NotFoundException if no song exists with `id`.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Song> {
    try {
      const song = await this.songsService.findOne(id);

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

  /**
   * Update a song by id. Only the supplied fields are changed.
   * @throws BadRequestException if the update payload is empty.
   * @throws NotFoundException if no song exists with `id`.
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<CreateSongDto>,
  ): Promise<Song> {
    try {
      // An empty body would otherwise silently no-op — reject it explicitly
      // rather than returning 200 for an update that changed nothing.
      if (!body || Object.keys(body).length === 0) {
        throw new BadRequestException('Song update payload is required');
      }

      const song = await this.songsService.update(id, body);

      if (!song) {
        throw new NotFoundException(`Song with id ${id} was not found`);
      }

      return song;
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

  /**
   * Delete a song by id.
   * @throws NotFoundException if no song exists with `id`.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    try {
      const removed = await this.songsService.remove(id);

      if (!removed) {
        throw new NotFoundException(`Song with id ${id} was not found`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to delete song');
    }
  }
}
