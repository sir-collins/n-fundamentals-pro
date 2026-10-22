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
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { PrismaSongsService, SongWithArtists } from './prisma-songs.service';
import { Paginated } from '../songs/songs.service';
import { CreateSongDto } from '../songs/dto/create-song-dto';
import { PaginationQueryDto } from '../songs/dto/pagination-query.dto';
import { UpdateSongInput } from '../songs/dto/update-song.input';
import { Song } from '../songs/entities/song.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

/**
 * REST endpoints for songs stored through Prisma (Project 9) — a mirror of
 * `SongsController` at `/prisma/songs`: same routes, guards, status codes,
 * error messages and guard-clause/catch shape, so the only difference
 * between the two is the service (and so the ORM) underneath.
 *
 * Swagger types reuse the TypeORM `Song` class purely as documentation:
 * Prisma's generated `Song` is a TypeScript type with no runtime presence,
 * so it can't carry `@ApiProperty()`. The JSON shapes are identical.
 */
@ApiTags('prisma-songs')
@ApiExtraModels(Song)
@Controller('prisma/songs')
export class PrismaSongsController {
  constructor(private readonly songsService: PrismaSongsService) {}

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
  async create(@Body() createSongDto: CreateSongDto): Promise<SongWithArtists> {
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
  ): Promise<Paginated<SongWithArtists>> {
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
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SongWithArtists> {
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
   * Update a song by id. Only the supplied fields are changed; supplied
   * `artists` replace the current ones. Requires an authenticated `admin`.
   * @throws BadRequestException if the update payload is empty.
   * @throws NotFoundException if no song exists with `id`.
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update a song by id. Only the supplied fields are changed. Requires an authenticated admin.',
  })
  // Same as SongsController.update: UpdateSongInput carries the validation
  // rules but no @ApiProperty, so Swagger documents the full DTO.
  @ApiBody({ type: CreateSongDto, description: 'Any subset of these fields.' })
  @ApiResponse({ status: 200, description: 'The updated song.', type: Song })
  @ApiResponse({ status: 400, description: 'Empty or invalid payload.' })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Authenticated but not admin.' })
  @ApiResponse({ status: 404, description: 'No song exists with this id.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateSongInput,
  ): Promise<SongWithArtists> {
    try {
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
