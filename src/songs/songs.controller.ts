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
import { SongsService } from './songs.service';
import { Paginated } from '../common/pagination/paginated';
import { CreateSongDto } from './dto/create-song.dto';
import { PaginationQueryDto } from '../common/pagination/pagination-query.dto';
import { UpdateSongInput } from './dto/update-song.input';
import { Song } from './entities/song.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

/**
 * REST endpoints for the `songs` resource. Reads are public; mutations
 * require an `admin`. `AuthGuard('jwt')` must come before `RolesGuard`,
 * which reads the `req.user` it sets.
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
    return this.songsService.create(createSongDto);
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
    return this.songsService.findAll(pagination);
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
    const song = await this.songsService.findOne(id);

    if (!song) {
      throw new NotFoundException(`Song with id ${id} was not found`);
    }

    return song;
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
  // UpdateSongInput's PartialType (from @nestjs/graphql) copies the
  // validation rules but not @ApiProperty, so Swagger is pointed at the
  // full DTO instead.
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
    // A real class, not `Partial<CreateSongDto>`: that type is erased at
    // runtime, so ValidationPipe would see a plain Object and check nothing.
    @Body() body: UpdateSongInput,
  ): Promise<Song> {
    // Reject rather than return 200 for an update that changed nothing.
    if (!body || Object.keys(body).length === 0) {
      throw new BadRequestException('Song update payload is required');
    }

    const song = await this.songsService.update(id, body);

    if (!song) {
      throw new NotFoundException(`Song with id ${id} was not found`);
    }

    return song;
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
    const removed = await this.songsService.remove(id);

    if (!removed) {
      throw new NotFoundException(`Song with id ${id} was not found`);
    }
  }
}
