import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PubSub } from 'graphql-subscriptions';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentsGateway } from './comments.gateway';
import { PUB_SUB } from './pub-sub.provider';
import { PaginationQueryDto } from '../common/pagination/pagination-query.dto';
import { Paginated } from '../common/pagination/paginated';

/** Comment storage in MongoDB, plus real-time fan-out of new comments. */
@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    private readonly commentsGateway: CommentsGateway,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  /**
   * Create a comment on `songId` and push it to Socket.IO and GraphQL
   * subscribers.
   * @throws BadRequestException if `parentCommentId` doesn't exist, or
   *   belongs to a different song.
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
   * One page of the comments on `songId`, oldest first, flat, with each
   * reply's parent populated. `_id` breaks ties between equal timestamps so
   * pages never overlap or skip.
   */
  async findAllForSong(
    songId: number,
    { page, limit }: PaginationQueryDto,
  ): Promise<Paginated<CommentDocument>> {
    const [data, total] = await Promise.all([
      this.commentModel
        .find({ songId })
        .sort({ createdAt: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('parentComment')
        .exec(),
      this.commentModel.countDocuments({ songId }).exec(),
    ]);
    return { data, total };
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
