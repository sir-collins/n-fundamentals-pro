import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentDocument } from './schemas/comment.schema';
import { SongsService } from '../songs/songs.service';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { PaginationQueryDto } from '../common/pagination/pagination-query.dto';
import { Paginated } from '../common/pagination/paginated';

/**
 * REST endpoints for song comments, stored in MongoDB. Routes span two
 * bases (`songs/:songId/comments` and `comments/:id`), so each route has a
 * full path instead of a class-level prefix.
 *
 * Any authenticated user can comment. Delete is an ownership check (author
 * or admin) done in the handler, so `RolesGuard` isn't used.
 */
@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly songsService: SongsService,
  ) {}

  /**
   * Comment on a song. Requires a logged-in user (any role).
   * @throws NotFoundException if no song exists with `songId`.
   * @throws BadRequestException if `parentCommentId` doesn't exist, or
   *   belongs to a different song.
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Comment on a song. Requires a logged-in user (any role).',
  })
  @ApiResponse({ status: 201, description: 'Comment created.' })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
  @ApiResponse({ status: 404, description: 'No song exists with this id.' })
  @UseGuards(AuthGuard('jwt'))
  @Post('songs/:songId/comments')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('songId', ParseIntPipe) songId: number,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CommentDocument> {
    const song = await this.songsService.findOne(songId);

    if (!song) {
      throw new NotFoundException(`Song with id ${songId} was not found`);
    }

    return await this.commentsService.create(songId, user.id, user.email, dto);
  }

  /**
   * List a song's comments, one page at a time, oldest first. Public. A
   * flat list, with each reply's immediate parent populated inline.
   * @throws NotFoundException if no song exists with `songId`.
   */
  @ApiOperation({
    summary:
      "List a song's comments, oldest first (?page=&limit=, both optional; replies' parents populated inline).",
  })
  @ApiResponse({
    status: 200,
    description: "A page of the song's comments.",
    schema: {
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'No song exists with this id.' })
  @Get('songs/:songId/comments')
  async findAllForSong(
    @Param('songId', ParseIntPipe) songId: number,
    @Query() pagination: PaginationQueryDto,
  ): Promise<Paginated<CommentDocument>> {
    const song = await this.songsService.findOne(songId);

    if (!song) {
      throw new NotFoundException(`Song with id ${songId} was not found`);
    }

    return this.commentsService.findAllForSong(songId, pagination);
  }

  /**
   * Delete a comment. Requires the comment's own author, or an admin.
   * @throws NotFoundException if no comment exists with `id`.
   * @throws ForbiddenException if the caller is neither the author nor an admin.
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Delete a comment. Requires the comment's own author, or an admin.",
  })
  @ApiResponse({ status: 200, description: 'Comment deleted.' })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
  @ApiResponse({
    status: 403,
    description: 'Caller is neither the author nor an admin.',
  })
  @ApiResponse({ status: 404, description: 'No comment exists with this id.' })
  @UseGuards(AuthGuard('jwt'))
  @Delete('comments/:id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Comment with id ${id} was not found`);
    }

    const comment = await this.commentsService.findOne(id);

    if (!comment) {
      throw new NotFoundException(`Comment with id ${id} was not found`);
    }

    if (comment.authorId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only the comment author or an admin can delete this comment',
      );
    }

    await this.commentsService.remove(id);
    return { message: 'Comment deleted' };
  }
}
