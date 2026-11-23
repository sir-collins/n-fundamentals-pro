import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { HydratedDocument, Types } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

/**
 * A comment on a song, in MongoDB: user-generated content that shouldn't
 * need a migration for every shape change. `@ObjectType()` serves only the
 * `commentAdded` subscription; comment CRUD is REST-only.
 */
@Schema({ timestamps: true })
@ObjectType()
export class Comment {
  // Not a `@Prop()`: Mongoose's `.id` virtual already provides it. Declared
  // only for the GraphQL schema.
  @Field(() => ID)
  id!: string;

  // A Postgres song id, not a Mongoose `ref`: there's no cross-database
  // populate, so the controller checks it exists via SongsService.
  @Field(() => Int)
  @Prop({ required: true })
  songId!: number;

  // Postgres user id and email, copied from req.user so a comment can be
  // shown without a Postgres lookup.
  @Field(() => Int)
  @Prop({ required: true })
  authorId!: number;

  @Field()
  @Prop({ required: true })
  authorEmail!: string;

  @Field()
  @Prop({ required: true, maxlength: 2000 })
  body!: string;

  // `null` for a top-level comment. Populated for REST reads; GraphQL
  // exposes it as a bare id.
  @Field(() => ID, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: 'Comment', default: null })
  parentComment!: Types.ObjectId | null;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
