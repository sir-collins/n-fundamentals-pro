import type { Request } from 'express';
import type DataLoader from 'dataloader';
import type { Artist } from '../artists/entities/artist.entity';

/**
 * What every GraphQL resolver's `@Context()` holds — built once per
 * request by the `context` factory in `app.module.ts`. `req` is what
 * `GqlAuthGuard` and `AuthResolver.profile` read; `loaders` are the
 * per-request DataLoaders.
 */
export interface GqlContext {
  req: Request;
  loaders: {
    artistsBySong: DataLoader<number, Artist[]>;
  };
}
