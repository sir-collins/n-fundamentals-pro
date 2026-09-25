import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PubSub } from 'graphql-subscriptions';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentsGateway } from './comments.gateway';
import { PUB_SUB } from './pub-sub.provider';

/**
 * Backed by MongoDB via Mongoose. Follows `SongsService`'s division of
 * responsibility: no try/catch here — plain async methods, `null` for
 * "not found," rejections propagate to the controller, which owns all
 * HTTP-status handling.
 */
@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    private readonly commentsGateway: CommentsGateway,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  /**
   * Create a comment on `songId`, authored by the caller. Broadcasts it
   * to everyone currently subscribed to that song's WebSocket room
   * (`CommentsGateway`) and to any GraphQL `commentAdded` subscribers
   * (`CommentsResolver`) before returning — two independent real-time
   * mechanisms over the same event, neither replacing the other.
   * @throws BadRequestException if `parentCommentId` doesn't exist, or
   *   belongs to a different song — a reply must live on the same song
   *   as the comment it replies to.
   */
  async create(
    songId: number,
    authorId: number,
    authorEmail: string,
    dto: CreateCommentDto,
  ): Promise<CommentDocument> {
    let parentComment: Types.ObjectId | null = null;

    if (dto.parentCommentId) {
      const parent = await this.commentModel.findById(dto.parentCommentId);

      if (!parent || parent.songId !== songId) {
        throw new BadRequestException(
          'parentCommentId does not exist on this song',
        );
      }

      parentComment = parent._id;
    }

    const comment = await this.commentModel.create({
      songId,
      authorId,
      authorEmail,
      body: dto.body,
      parentComment,
    });
    this.commentsGateway.broadcastNewComment(songId, comment);
    await this.pubSub.publish('commentAdded', { commentAdded: comment });
    return comment;
  }

  /**
   * List every comment on `songId`, flat (not a nested tree) with each
   * reply's immediate parent populated inline.
   */
  findAllForSong(songId: number): Promise<CommentDocument[]> {
    return this.commentModel.find({ songId }).populate('parentComment').exec();
  }

  /** Find a comment by id, or `null` if none exists. */
  findOne(id: string): Promise<CommentDocument | null> {
    return this.commentModel.findById(id).exec();
  }

  /**
   * Remove the comment with `id`.
   * @returns whether a comment was found and removed.
   */
  async remove(id: string): Promise<boolean> {
    const result = await this.commentModel.deleteOne({ _id: id });
    return result.deletedCount !== 0;
  }
}
