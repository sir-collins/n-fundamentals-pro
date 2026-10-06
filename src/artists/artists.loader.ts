import DataLoader from 'dataloader';
import { Artist } from './entities/artist.entity';
import { ArtistsService } from './artists.service';

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
