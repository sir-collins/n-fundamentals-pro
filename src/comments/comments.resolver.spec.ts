import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { PubSub } from 'graphql-subscriptions';
import { CommentsResolver, commentAddedFilter } from './comments.resolver';
import { PUB_SUB } from './pub-sub.provider';
import { Comment } from './schemas/comment.schema';

describe('CommentsResolver', () => {
  let resolver: CommentsResolver;
  let pubSub: PubSub;

  beforeEach(async () => {
    // A real `PubSub`, not a mock — it's in-memory with no I/O, so using
    // the real thing proves events actually flow through the iterator,
    // not just that some method got called.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsResolver,
        { provide: PUB_SUB, useValue: new PubSub() },
      ],
    }).compile();

    resolver = module.get<CommentsResolver>(CommentsResolver);
    pubSub = module.get(PUB_SUB);
  });

  describe('commentAdded', () => {
    it('yields comments published on the `commentAdded` trigger', async () => {
      const comment = { songId: 3, body: 'Great track' } as Comment;
      const iterator = resolver.commentAdded(3);

      // Start waiting before publishing — `PubSub` only delivers to
      // listeners already subscribed at publish time.
      const next = iterator.next();
      // Same trigger + payload shape `CommentsService.create()` publishes.
      await pubSub.publish('commentAdded', { commentAdded: comment });

      expect(await next).toEqual({
        value: { commentAdded: comment },
        done: false,
      });
      await iterator.return?.();
    });
  });

  describe('commentAddedFilter', () => {
    const payload = { commentAdded: { songId: 3 } as Comment };

    it('delivers a comment to subscribers of the same song', () => {
      expect(commentAddedFilter(payload, { songId: 3 })).toBe(true);
    });

    it('withholds a comment from subscribers of a different song', () => {
      expect(commentAddedFilter(payload, { songId: 4 })).toBe(false);
    });
  });
});
