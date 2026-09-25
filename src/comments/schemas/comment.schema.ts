import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { HydratedDocument, Types } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

/**
 * A comment on a song, stored in MongoDB rather than Postgres — a better
 * fit for user-generated content than a migration-backed relational
 * table. `timestamps: true` adds `createdAt`/`updatedAt` automatically.
 *
 * `@ObjectType()` here backs `CommentsResolver`'s `commentAdded`
 * subscription — the first GraphQL surface for comments at all (still no
 * comment queries/mutations over GraphQL, deliberately: creation/reads
 * stay REST-only, this is a real-time notification layer, not a second
 * comments CRUD API).
 */
@Schema({ timestamps: true })
@ObjectType()
export class Comment {
  // Not a `@Prop()` — Mongoose already exposes `.id` as an automatic
  // virtual getter (the string form of `_id`) on every hydrated
  // document, so this field exists purely for GraphQL's benefit, not as
  // a second stored column.
  @Field(() => ID)
  id!: string;

  // The Postgres Song's id. Deliberately a plain number, not a Mongoose
  // `ref` — there's no cross-database `populate()`, so a songId's
  // existence is validated at the service layer (via SongsService)
  // instead of by Mongoose itself.
  @Field(() => Int)
  @Prop({ required: true })
  songId!: number;

  // The Postgres User's id/email, stamped from req.user at creation time.
  // Denormalized (not a ref) for the same cross-database reason as
  // songId — email is duplicated here so a comment can be displayed
  // without a round trip back to Postgres.
  @Field(() => Int)
  @Prop({ required: true })
  authorId!: number;

  @Field()
  @Prop({ required: true })
  authorEmail!: string;

  @Field()
  @Prop({ required: true, maxlength: 2000 })
  body!: string;

  // The real Mongo-to-Mongo reference — self-referential so replies form
  // a thread. `null` for a top-level comment. This is what
  // `.populate('parentComment')` resolves in CommentsService (REST only
  // — the GraphQL subscription below exposes it as a bare id, not a
  // populated object, since a live notification doesn't need the
  // parent's full body/author expanded).
  @Field(() => ID, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: 'Comment', default: null })
  parentComment!: Types.ObjectId | null;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
