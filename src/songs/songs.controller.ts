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
  Query,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { SongsService, Paginated } from './songs.service';
import { CreateSongDto } from './dto/create-song-dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { Song } from './entities/song.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

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
 *
 * Reads (`findAll`, `findOne`) are public. Mutations (`create`, `update`,
 * `delete`) require a logged-in `admin` — `AuthGuard('jwt')` runs first
 * (populating `req.user`), then `RolesGuard` checks the role; order in
 * `@UseGuards(...)` matters for that reason.
 */
@ApiTags('songs')
// Paginated<Song> (songs.service.ts) is a plain interface, not a class —
// registering Song here lets findAll's raw `schema:` below $ref it.
@ApiExtraModels(Song)
@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  /** Create a song. Requires an authenticated `admin`. */
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a song. Requires an authenticated admin.' })
  @ApiResponse({ status: 201, description: 'Song created.', type: Song })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Authenticated but not admin.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSongDto: CreateSongDto): Promise<Song> {
    try {
      return await this.songsService.create(createSongDto);
    } catch {
      throw new InternalServerErrorException('Failed to create song');
    }
  }

  /** List songs, one page at a time (`?page=&limit=`, both optional). */
  @ApiOperation({
    summary: 'List songs, one page at a time (?page=&limit=, both optional).',
  })
  @ApiResponse({
    status: 200,
    description: 'A page of songs.',
    schema: {
      properties: {
        data: { type: 'array', items: { $ref: getSchemaPath(Song) } },
        total: { type: 'number' },
      },
    },
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() pagination: PaginationQueryDto,
  ): Promise<Paginated<Song>> {
    try {
      return await this.songsService.findAll(pagination);
    } catch {
      throw new InternalServerErrorException('Failed to fetch songs');
    }
  }

  /**
   * Fetch a single song by id.
   * @throws NotFoundException if no song exists with `id`.
   */
  @ApiOperation({ summary: 'Fetch a single song by id.' })
  @ApiResponse({ status: 200, description: 'The song.', type: Song })
  @ApiResponse({ status: 404, description: 'No song exists with this id.' })
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
   * Update a song by id. Only the supplied fields are changed. Requires
   * an authenticated `admin`.
   * @throws BadRequestException if the update payload is empty.
   * @throws NotFoundException if no song exists with `id`.
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update a song by id. Only the supplied fields are changed. Requires an authenticated admin.',
  })
  @ApiResponse({ status: 200, description: 'The updated song.', type: Song })
  @ApiResponse({ status: 400, description: 'Empty update payload.' })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Authenticated but not admin.' })
  @ApiResponse({ status: 404, description: 'No song exists with this id.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
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
   * Delete a song by id. Requires an authenticated `admin`.
   * @throws NotFoundException if no song exists with `id`.
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a song by id. Requires an authenticated admin.',
  })
  @ApiResponse({ status: 204, description: 'Song deleted.' })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Authenticated but not admin.' })
  @ApiResponse({ status: 404, description: 'No song exists with this id.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
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
