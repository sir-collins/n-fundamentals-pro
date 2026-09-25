import { Inject } from '@nestjs/common';
import { Args, Int, Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { Comment } from './schemas/comment.schema';
import { PUB_SUB } from './pub-sub.provider';

/**
 * GraphQL's real-time counterpart to `CommentsGateway` (Project 7's
 * WebSocket layer) — deliberately subscription-only, no queries or
 * mutations here. Comments are still only created via the existing REST
 * endpoint (`CommentsController.create`); this subscription fires
 * regardless of which API layer triggered the creation, since publishing
 * happens once, in `CommentsService`. Unguarded, matching
 * `subscribeToSong` (WS) and `GET .../comments` (REST) — only comment
 * creation/deletion require auth, not reads/notifications.
 */
@Resolver(() => Comment)
export class CommentsResolver {
  constructor(@Inject(PUB_SUB) private readonly pubSub: PubSub) {}

  /**
   * Fires with the new comment/reply whenever one is created on `songId`.
   * `filter` is the GraphQL-native equivalent of the WS gateway's
   * per-song Socket.IO room — a client subscribed to one song never
   * receives an event published for another.
   */
  @Subscription(() => Comment, {
    filter: (
      payload: { commentAdded: Comment },
      variables: { songId: number },
    ) => payload.commentAdded.songId === variables.songId,
  })
  // `songId` only needs to exist for `@Args()` to generate the schema
  // argument — the actual filtering reads it from `variables` in
  // `filter` above, not from this parameter, same as Nest's own
  // official subscription example.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  commentAdded(@Args('songId', { type: () => Int }) songId: number) {
    return this.pubSub.asyncIterableIterator('commentAdded');
  }
}
