import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaRelationsService } from './prisma-relations.service';
import { BulkUpdateSongsDto } from './dto/bulk-update-songs.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

/**
 * Bulk song updates (Project 9, bulk operations) at `/prisma/songs/bulk`.
 * Its own controller so `PrismaSongsController` stays a line-for-line
 * mirror of `SongsController`; that one has no PATCH, so nothing collides.
 */
@ApiTags('prisma-relations')
@Controller('prisma/songs')
export class PrismaBulkSongsController {
  constructor(private readonly relationsService: PrismaRelationsService) {}

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
