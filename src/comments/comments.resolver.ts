import { Inject } from '@nestjs/common';
import { Args, Int, Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { Comment } from './schemas/comment.schema';
import { PUB_SUB } from './pub-sub.provider';

/**
 * `commentAdded`'s per-subscriber filter, the equivalent of the gateway's
 * per-song room. Exported so it can be unit tested.
 */
export function commentAddedFilter(
  payload: { commentAdded: Comment },
  variables: { songId: number },
): boolean {
  return payload.commentAdded.songId === variables.songId;
}

/**
 * GraphQL counterpart to `CommentsGateway`. Subscription-only: comments
 * are created over REST, and `CommentsService` publishes each one.
 * Unguarded, like the other comment reads.
 */
@Resolver(() => Comment)
export class CommentsResolver {
  constructor(@Inject(PUB_SUB) private readonly pubSub: PubSub) {}

  /** Fires with each new comment or reply on `songId`. */
  @Subscription(() => Comment, { filter: commentAddedFilter })
  // `songId` is here only to declare the schema argument; the filter reads
  // it from `variables`.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  commentAdded(@Args('songId', { type: () => Int }) songId: number) {
    return this.pubSub.asyncIterableIterator('commentAdded');
  }
}
