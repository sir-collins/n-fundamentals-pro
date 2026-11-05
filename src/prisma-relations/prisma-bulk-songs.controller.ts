import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  PrismaRelationsService,
  SongTitleConflictError,
} from './prisma-relations.service';
import { BulkUpdateSongsDto } from './dto/bulk-update-songs.dto';
import { ImportSongsDto } from './dto/import-songs.dto';
import { SongWithArtists } from '../prisma-songs/prisma-songs.service';
import { Song } from '../songs/entities/song.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

/**
 * Bulk song routes at `/prisma/songs/bulk` (Project 9): updates (bulk
 * operations) and an all-or-nothing import (transactions). Their own
 * controller so `PrismaSongsController` stays a line-for-line mirror of
 * `SongsController`. Nothing collides: that one has no PATCH, and its
 * POST is on `/prisma/songs` itself.
 */
@ApiTags('prisma-relations')
@Controller('prisma/songs')
export class PrismaBulkSongsController {
  constructor(private readonly relationsService: PrismaRelationsService) {}

  /**
   * Import several songs with their artists, all or nothing: if any title
   * already exists (in the database or earlier in the same batch),
   * nothing is written. Requires an authenticated `admin`.
   * @throws ConflictException naming the first title that exists.
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Import several songs with their artists, all or nothing. Requires an authenticated admin.',
  })
  @ApiResponse({ status: 201, description: 'Songs created.', type: [Song] })
  @ApiResponse({ status: 400, description: 'Empty, too many, or invalid.' })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Authenticated but not admin.' })
  @ApiResponse({
    status: 409,
    description: 'A title already exists; nothing was written.',
  })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  async importSongs(@Body() body: ImportSongsDto): Promise<SongWithArtists[]> {
    try {
      return await this.relationsService.importSongs(body.songs);
    } catch (error) {
      if (error instanceof SongTitleConflictError) {
        throw new ConflictException(error.message);
      }

      throw new InternalServerErrorException('Failed to import songs');
    }
  }

  /**
   * Apply the same change to several songs. Ids with no song are not an
   * error; they just aren't counted. Requires an authenticated `admin`.
   * @throws BadRequestException if neither field to change is supplied.
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Apply the same releaseDate/duration to several songs. Requires an authenticated admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'How many songs were updated (missing ids are not counted).',
    schema: { properties: { count: { type: 'number' } } },
  })
  @ApiResponse({ status: 400, description: 'Nothing to change, or invalid.' })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Authenticated but not admin.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('bulk')
  @HttpCode(HttpStatus.OK)
  async updateMany(
    @Body() body: BulkUpdateSongsDto,
  ): Promise<{ count: number }> {
    try {
      if (body.releaseDate === undefined && body.duration === undefined) {
        throw new BadRequestException(
          'At least one of releaseDate or duration is required',
        );
      }

      return await this.relationsService.updateSongs(body);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to update songs');
    }
  }
}
