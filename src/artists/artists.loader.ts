import DataLoader from 'dataloader';
import { Artist } from './entities/artist.entity';
import { ArtistsService } from './artists.service';
import { DeezerService } from './deezer.service';
import { ArtistProfile } from './dto/artist-profile.type';

/**
 * Batches every `Song.artists` lookup made while resolving one GraphQL
 * response into a single `findBySongIds` query — the fix for the N+1 a
 * per-song field resolver would otherwise cause.
 *
 * Must be created fresh per request (see the GraphQL `context` in
 * `app.module.ts`): DataLoader also caches by key, and a loader shared
 * across requests would keep serving whatever it loaded first.
 */
export function createArtistsBySongLoader(
  artistsService: ArtistsService,
): DataLoader<number, Artist[]> {
  return new DataLoader<number, Artist[]>(async (songIds) => {
    const bySong = await artistsService.findBySongIds(songIds);
    // DataLoader's contract: exactly one result per key, in key order —
    // the map's own order is whatever the query returned, so re-index it,
    // and a song with no artists still needs its (empty) slot.
    return songIds.map((songId) => bySong.get(songId) ?? []);
  });
}

/**
 * Per-request loader behind `Artist.profile`, keyed by artist name.
 * Deezer has no batch endpoint, so this can't merge lookups into one
 * call — its job is deduplication (an artist on five songs is one HTTP
 * call, not five) and running the distinct lookups in parallel.
 *
 * Each key's failure is returned as that key's `Error` rather than
 * rejecting the whole batch, so one artist's Deezer error only nulls out
 * that artist's `profile`, not every artist in the response.
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
