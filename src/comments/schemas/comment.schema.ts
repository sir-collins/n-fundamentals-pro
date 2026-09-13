import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

/**
 * A comment on a song, stored in MongoDB rather than Postgres — a better
 * fit for user-generated content than a migration-backed relational
 * table. `timestamps: true` adds `createdAt`/`updatedAt` automatically.
 */
@Schema({ timestamps: true })
export class Comment {
  // The Postgres Song's id. Deliberately a plain number, not a Mongoose
  // `ref` — there's no cross-database `populate()`, so a songId's
  // existence is validated at the service layer (via SongsService)
  // instead of by Mongoose itself.
  @Prop({ required: true })
  songId!: number;

  // The Postgres User's id/email, stamped from req.user at creation time.
  // Denormalized (not a ref) for the same cross-database reason as
  // songId — email is duplicated here so a comment can be displayed
  // without a round trip back to Postgres.
  @Prop({ required: true })
  authorId!: number;

  @Prop({ required: true })
  authorEmail!: string;

  @Prop({ required: true, maxlength: 2000 })
  body!: string;

  // The real Mongo-to-Mongo reference — self-referential so replies form
  // a thread. `null` for a top-level comment. This is what
  // `.populate('parentComment')` resolves in CommentsService.
  @Prop({ type: Types.ObjectId, ref: 'Comment', default: null })
  parentComment!: Types.ObjectId | null;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
