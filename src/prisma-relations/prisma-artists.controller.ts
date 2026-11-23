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
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Album } from '../generated/prisma/client';
import {
  ArtistDetail,
  PrismaRelationsService,
} from './prisma-relations.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { CreateAlbumsDto } from './dto/create-albums.dto';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

// Inline Swagger schemas: Prisma's generated types have no runtime class to
// carry @ApiProperty.
const albumSchema = {
  properties: {
    id: { type: 'number' },
    title: { type: 'string' },
    releaseDate: { type: 'string' },
    artistId: { type: 'number' },
  },
};

const countSchema = { properties: { count: { type: 'number' } } };

/** Artists and their albums (one-to-many) at `/prisma/artists`. */
@ApiTags('prisma-relations')
@Controller('prisma/artists')
export class PrismaArtistsController {
  constructor(private readonly relationsService: PrismaRelationsService) {}

  /**
   * Delete every artist with no songs and no albums. Requires an
   * authenticated `admin`.
   */
  @ApiOperation({
    summary:
      'Delete every artist with no songs and no albums. Requires an authenticated admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'How many artists were deleted.',
    schema: countSchema,
  })
  @AdminOnly()
  // Declared before the `:id` routes: Nest matches in declaration order, so
  // a later `DELETE :id` can't swallow it.
  @Delete('orphans')
  @HttpCode(HttpStatus.OK)
  async deleteOrphans(): Promise<{ count: number }> {
    return this.relationsService.deleteOrphanArtists();
  }

  /**
   * Fetch an artist with their albums and song count.
   * @throws NotFoundException if no artist exists with `id`.
   */
  @ApiOperation({ summary: 'Fetch an artist with albums and song count.' })
  @ApiResponse({
    status: 200,
    description: 'The artist.',
    schema: {
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        albums: { type: 'array', items: albumSchema },
        _count: { properties: { songs: { type: 'number' } } },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'No artist exists with this id.' })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ArtistDetail> {
    const artist = await this.relationsService.findArtist(id);

    if (!artist) {
      throw new NotFoundException(`Artist with id ${id} was not found`);
    }

    return artist;
  }

  /**
   * Add an album to an artist. Requires an authenticated `admin`.
   * @throws NotFoundException if no artist exists with `id`.
   */
  @ApiOperation({
    summary: 'Add an album to an artist. Requires an authenticated admin.',
  })
  @ApiResponse({
    status: 201,
    description: 'Album created.',
    schema: albumSchema,
  })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 404, description: 'No artist exists with this id.' })
  @AdminOnly()
  @Post(':id/albums')
  @HttpCode(HttpStatus.CREATED)
  async addAlbum(
    @Param('id', ParseIntPipe) id: number,
    @Body() createAlbumDto: CreateAlbumDto,
  ): Promise<Album> {
    const album = await this.relationsService.addAlbum(id, createAlbumDto);

    if (!album) {
      throw new NotFoundException(`Artist with id ${id} was not found`);
    }

    return album;
  }

  /**
   * Add several albums to an artist in one insert; titles the artist
   * already has are skipped. Requires an authenticated `admin`.
   * @throws NotFoundException if no artist exists with `id`.
   */
  @ApiOperation({
    summary:
      'Add several albums to an artist; existing titles are skipped. Requires an authenticated admin.',
  })
  @ApiResponse({
    status: 201,
    description: 'The albums created (skipped duplicates are not listed).',
    schema: {
      properties: { created: { type: 'array', items: albumSchema } },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 404, description: 'No artist exists with this id.' })
  @AdminOnly()
  @Post(':id/albums/bulk')
  @HttpCode(HttpStatus.CREATED)
  async addAlbums(
    @Param('id', ParseIntPipe) id: number,
    @Body() { albums }: CreateAlbumsDto,
  ): Promise<{ created: Album[] }> {
    const created = await this.relationsService.addAlbums(id, albums);

    if (!created) {
      throw new NotFoundException(`Artist with id ${id} was not found`);
    }

    return { created };
  }
}
