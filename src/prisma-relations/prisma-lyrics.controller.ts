import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Lyrics } from '../generated/prisma/client';
import { PrismaRelationsService } from './prisma-relations.service';
import { UpsertLyricsDto } from './dto/upsert-lyrics.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

const lyricsSchema = {
  properties: {
    id: { type: 'number' },
    text: { type: 'string' },
    songId: { type: 'number' },
  },
};

/**
 * A song's lyrics (one-to-one) at `/prisma/songs/:id/lyrics`. Kept out of
 * `PrismaSongsController` so that one stays a mirror of `SongsController`.
 */
@ApiTags('prisma-relations')
@Controller('prisma/songs')
export class PrismaLyricsController {
  constructor(private readonly relationsService: PrismaRelationsService) {}

  /**
   * Fetch a song's lyrics.
   * @throws NotFoundException if the song has no lyrics (or doesn't exist).
   */
  @ApiOperation({ summary: "Fetch a song's lyrics." })
  @ApiResponse({
    status: 200,
    description: 'The lyrics.',
    schema: lyricsSchema,
  })
  @ApiResponse({ status: 404, description: 'The song has no lyrics.' })
  @Get(':id/lyrics')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Lyrics> {
    const lyrics = await this.relationsService.findLyrics(id);

    if (!lyrics) {
      throw new NotFoundException(`Song with id ${id} has no lyrics`);
    }

    return lyrics;
  }

  /**
   * Set a song's lyrics, creating or replacing them. Requires an
   * authenticated `admin`.
   * @throws NotFoundException if no song exists with `id`.
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Set a song's lyrics (created or replaced). Requires an authenticated admin.",
  })
  @ApiResponse({
    status: 200,
    description: 'The lyrics.',
    schema: lyricsSchema,
  })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Authenticated but not admin.' })
  @ApiResponse({ status: 404, description: 'No song exists with this id.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put(':id/lyrics')
  @HttpCode(HttpStatus.OK)
  async upsert(
    @Param('id', ParseIntPipe) id: number,
    @Body() upsertLyricsDto: UpsertLyricsDto,
  ): Promise<Lyrics> {
    const lyrics = await this.relationsService.upsertLyrics(
      id,
      upsertLyricsDto,
    );

    if (!lyrics) {
      throw new NotFoundException(`Song with id ${id} was not found`);
    }

    return lyrics;
  }
}
