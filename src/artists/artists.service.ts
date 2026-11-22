import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Artist } from './entities/artist.entity';

/**
 * Resolves artist *names* (as sent by clients) to real `Artist` rows,
 * creating them the first time a name is seen. Keeps `SongsService` from
 * needing to know how artist identity/uniqueness works.
 */
@Injectable()
export class ArtistsService {
  constructor(
    @InjectRepository(Artist)
    private readonly artistsRepository: Repository<Artist>,
  ) {}

  /**
   * Find an existing Artist for each name, creating any that don't exist
   * yet.
   * @returns one Artist per unique name in `names` (order not guaranteed).
   */
  async findOrCreateMany(names: string[]): Promise<Artist[]> {
    // Dedupe the input first — without this, two new names that are the
    // same string would both try to insert a row with that name and hit
    // the unique constraint.
    const uniqueNames = [...new Set(names)];

    const existing = await this.artistsRepository.findBy({
      name: In(uniqueNames),
    });
    const existingNames = new Set(existing.map((artist) => artist.name));
    const newNames = uniqueNames.filter((name) => !existingNames.has(name));

    if (newNames.length === 0) {
      return existing;
    }

    const created = await this.artistsRepository.save(
      newNames.map((name) => this.artistsRepository.create({ name })),
    );

    return [...existing, ...created];
  }

  /**
   * Every artist on each of `songIds`, in one query — the batch query
   * behind `createArtistsBySongLoader`. Only `song.id` is selected from
   * the join, just enough to group artists back under their song.
   * @returns a map keyed by song id; a song with no artists has no entry,
   *   and an artist on two requested songs appears under both.
   */
  async findBySongIds(
    songIds: readonly number[],
  ): Promise<Map<number, Artist[]>> {
    const bySong = new Map<number, Artist[]>();

    if (songIds.length === 0) {
      return bySong;
    }

    const artists = await this.artistsRepository
      .createQueryBuilder('artist')
      .innerJoin('artist.songs', 'song', 'song.id IN (:...songIds)', {
        songIds,
      })
      .addSelect('song.id')
      .orderBy('artist.id')
      .getMany();

    for (const artist of artists) {
      for (const song of artist.songs) {
        bySong.set(song.id, [...(bySong.get(song.id) ?? []), artist]);
      }
    }

    return bySong;
  }

  /**
   * Delete every artist that is on no song, in one `DELETE`. Closes
   * Project 2's known gap on the TypeORM side: an artist taken off every
   * song it was on stayed in the table. Run nightly by
   * `OrphanArtistsCleanupJob`.
   *
   * The orphan subquery is built from the `artist.songs` relation, so
   * TypeORM supplies the join-table and column names instead of this
   * method hard-coding them.
   * @returns how many artists were deleted.
   */
  async deleteOrphans(): Promise<number> {
    const orphanIds = this.artistsRepository
      .createQueryBuilder('orphan')
      .select('orphan.id')
      .leftJoin('orphan.songs', 'song')
      .where('song.id IS NULL');

    const result = await this.artistsRepository
      .createQueryBuilder()
      .delete()
      .where(`id IN (${orphanIds.getQuery()})`)
      .execute();

    return result.affected ?? 0;
  }
}
