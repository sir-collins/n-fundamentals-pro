import type { Request } from 'express';
import type DataLoader from 'dataloader';
import type { Artist } from '../artists/entities/artist.entity';
import type { ArtistProfile } from '../artists/dto/artist-profile.type';

/**
 * The GraphQL `@Context()`, built per request by the `context` factory in
 * `app.module.ts`. `loaders` are per-request so DataLoader caches never
 * span users.
 */
export interface GqlContext {
  req: Request;
  loaders: {
    artistsBySong: DataLoader<number, Artist[]>;
    artistProfile: DataLoader<string, ArtistProfile | null>;
  };
}
