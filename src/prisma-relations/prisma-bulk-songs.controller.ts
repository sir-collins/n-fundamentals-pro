import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  PrismaRelationsService,
  SongTitleConflictError,
} from './prisma-relations.service';
import { BulkUpdateSongsDto } from './dto/bulk-update-songs.dto';
import { ImportSongsDto } from './dto/import-songs.dto';
import { SongWithArtists } from '../prisma-songs/prisma-songs.service';
import { Song } from '../songs/entities/song.entity';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

/**
 * Bulk song import and update at `/prisma/songs/bulk`. Kept out of
 * `PrismaSongsController` so that one stays a mirror of `SongsController`.
 */
@ApiTags('prisma-relations')
@Controller('prisma/songs')
export class PrismaBulkSongsController {
  constructor(private readonly relationsService: PrismaRelationsService) {}

  /**
   * Import several songs with their artists, all or nothing. Requires an
   * authenticated `admin`.
   * @throws ConflictException if any title already exists, in the database
   *   or earlier in the batch; nothing is written.
   */
  @ApiOperation({
    summary:
      'Import several songs with their artists, all or nothing. Requires an authenticated admin.',
  })
  @ApiResponse({ status: 201, description: 'Songs created.', type: [Song] })
  @ApiResponse({ status: 400, description: 'Empty, too many, or invalid.' })
  @ApiResponse({
    status: 409,
    description: 'A title already exists; nothing was written.',
  })
  @AdminOnly()
  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  async importSongs(@Body() body: ImportSongsDto): Promise<SongWithArtists[]> {
    try {
      return await this.relationsService.importSongs(body.songs);
    } catch (error) {
      if (error instanceof SongTitleConflictError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  /**
   * Apply the same change to several songs; unknown ids are ignored, not
   * errors. Requires an authenticated `admin`.
   * @throws BadRequestException if neither field to change is supplied.
   */
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
  @AdminOnly()
  @Patch('bulk')
  @HttpCode(HttpStatus.OK)
  async updateMany(
    @Body() body: BulkUpdateSongsDto,
  ): Promise<{ count: number }> {
    if (body.releaseDate === undefined && body.duration === undefined) {
      throw new BadRequestException(
        'At least one of releaseDate or duration is required',
      );
    }

    return await this.relationsService.updateSongs(body);
  }
}
