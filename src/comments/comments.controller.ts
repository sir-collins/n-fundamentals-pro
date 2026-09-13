import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Types } from 'mongoose';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentDocument } from './schemas/comment.schema';
import { SongsService } from '../songs/songs.service';
import { UserRole } from '../users/entities/user.entity';

/**
 * REST endpoints for comments on `songs` — backed by MongoDB
 * (`CommentsService`), unlike every other resource in this app so far.
 * Routes deliberately span two bases (`songs/:songId/comments` and
 * `comments/:id`), so this controller uses full explicit paths per
 * route rather than a single class-level `@Controller(...)` prefix.
 *
 * Unlike `songs` mutations (admin-only), any authenticated user can post
 * a comment — this is user-generated content, not curated catalog data.
 * Deleting one's own comment doesn't need `RolesGuard` either: it's a
 * resource-*ownership* check (author or admin), not a role check.
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
    @Req() req: Request & { user: { id: number; email: string } },
  ): Promise<CommentDocument> {
    try {
      const song = await this.songsService.findOne(songId);

      if (!song) {
        throw new NotFoundException(`Song with id ${songId} was not found`);
      }

      return await this.commentsService.create(
        songId,
        req.user.id,
        req.user.email,
        dto,
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create comment');
    }
  }

  /**
   * List every comment on a song — public, same as song reads. Flat list
   * (not a nested tree); each reply's immediate parent comes back
   * populated inline via Mongoose's `ref`.
   * @throws NotFoundException if no song exists with `songId`.
   */
  @ApiOperation({
    summary:
      "List a song's comments (flat, replies' parents populated inline).",
  })
  @ApiResponse({ status: 200, description: "The song's comments." })
  @ApiResponse({ status: 404, description: 'No song exists with this id.' })
  @Get('songs/:songId/comments')
  async findAllForSong(
    @Param('songId', ParseIntPipe) songId: number,
  ): Promise<CommentDocument[]> {
    try {
      const song = await this.songsService.findOne(songId);

      if (!song) {
        throw new NotFoundException(`Song with id ${songId} was not found`);
      }

      return await this.commentsService.findAllForSong(songId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to fetch comments');
    }
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
    @Req() req: Request & { user: { id: number; role: UserRole } },
  ): Promise<{ message: string }> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new NotFoundException(`Comment with id ${id} was not found`);
      }

      const comment = await this.commentsService.findOne(id);

      if (!comment) {
        throw new NotFoundException(`Comment with id ${id} was not found`);
      }

      if (
        comment.authorId !== req.user.id &&
        req.user.role !== UserRole.ADMIN
      ) {
        throw new ForbiddenException(
          'Only the comment author or an admin can delete this comment',
        );
      }

      await this.commentsService.remove(id);
      return { message: 'Comment deleted' };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to delete comment');
    }
  }
}
