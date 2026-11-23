import DataLoader from 'dataloader';
import { Artist } from './entities/artist.entity';
import { ArtistsService } from './artists.service';
import { DeezerService } from './deezer.service';
import { ArtistProfile } from './dto/artist-profile.type';

/**
 * Batches every `Song.artists` lookup in one GraphQL response into a single
 * `findBySongIds` query, avoiding N+1.
 *
 * Create one per request (see the GraphQL `context` in `app.module.ts`):
 * DataLoader caches by key, so a shared loader would serve stale data.
 */
export function createArtistsBySongLoader(
  artistsService: ArtistsService,
): DataLoader<number, Artist[]> {
  return new DataLoader<number, Artist[]>(async (songIds) => {
    const bySong = await artistsService.findBySongIds(songIds);
    // DataLoader needs one result per key, in key order, including an
    // empty slot for a song with no artists.
    return songIds.map((songId) => bySong.get(songId) ?? []);
  });
}

/**
 * Per-request loader behind `Artist.profile`, keyed by artist name. Deezer
 * has no batch endpoint, so this only deduplicates names and runs the
 * lookups in parallel.
 *
 * A failed lookup is returned as that key's `Error` instead of rejecting
 * the batch, so it nulls out only that artist's `profile`.
 */
export function createArtistProfileLoader(
  deezerService: DeezerService,
): DataLoader<string, ArtistProfile | null> {
  return new DataLoader<string, ArtistProfile | null>((names) =>
    Promise.all(
      names.map((name) =>
        deezerService
          .findArtistProfile(name)
          .catch((error: unknown) =>
            error instanceof Error ? error : new Error(String(error)),
          ),
      ),
    ),
  );
}
