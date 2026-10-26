import { Injectable } from '@nestjs/common';
import type { Artist, Song } from '../generated/prisma/client';
import { isNotFound } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSongDto } from '../songs/dto/create-song-dto';
import { PaginationQueryDto } from '../songs/dto/pagination-query.dto';
import { UpdateSongInput } from '../songs/dto/update-song.input';
import { Paginated } from '../songs/songs.service';

/** A song with its artists — the shape every method here returns. */
export type SongWithArtists = Song & { artists: Artist[] };

// Every query loads artists, so responses match GET /songs exactly.
const withArtists = { artists: true } as const;

/**
 * The Prisma rebuild of `SongsService` (Project 9) — same inputs, same
 * outputs, same `null`/`false` for "not found", so `PrismaSongsController`
 * can mirror `SongsController` line for line and the two can be compared.
 *
 * No `ArtistsService` here: resolving artist names to rows (created on
 * first use) is a nested `connectOrCreate` inside the song query itself.
 */
@Injectable()
export class PrismaSongsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a song, connecting each named artist (created if new). */
  create(createSongDto: CreateSongDto): Promise<SongWithArtists> {
    const { artists, ...fields } = createSongDto;

    return this.prisma.song.create({
      data: { ...fields, artists: { connectOrCreate: toArtists(artists) } },
      include: withArtists,
    });
  }

  /** List songs, one page at a time, ordered by id. */
  async findAll({
    page,
    limit,
  }: PaginationQueryDto): Promise<Paginated<SongWithArtists>> {
    // Prisma has no findAndCount — the page and the total are two queries.
    // Run side by side here; a write landing between them could make them
    // disagree, which $transaction([...]) fixes (sub-step 5). `orderBy`
    // keeps pages stable: without it Postgres may return rows in any
    // order, so page 2 could repeat or skip rows from page 1.
    const [data, total] = await Promise.all([
      this.prisma.song.findMany({
        include: withArtists,
        orderBy: { id: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.song.count(),
    ]);

    return { data, total };
  }

  /** Find a song by id, or `null` if none exists. */
  findOne(id: number): Promise<SongWithArtists | null> {
    return this.prisma.song.findUnique({ where: { id }, include: withArtists });
  }

  /**
   * Update only the supplied fields of the song with `id`, in one query —
   * where TypeORM loads the row, merges, then saves. Supplied `artists`
   * replace the current ones (`set: []` clears the links first; without
   * it `connectOrCreate` would only add).
   * @returns the updated song, or `null` if no song exists with `id`.
   */
  async update(
    id: number,
    updateSongDto: UpdateSongInput,
  ): Promise<SongWithArtists | null> {
    const { artists, ...fields } = updateSongDto;

    try {
      return await this.prisma.song.update({
        where: { id },
        data: {
          ...fields,
          ...(artists && {
            artists: { set: [], connectOrCreate: toArtists(artists) },
          }),
        },
        include: withArtists,
      });
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Remove the song with `id`.
   * @returns whether a song was found and removed.
   */
  async remove(id: number): Promise<boolean> {
    try {
      await this.prisma.song.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isNotFound(error)) {
        return false;
      }
      throw error;
    }
  }
}

/** Artist names → `connectOrCreate` entries, duplicates dropped. */
function toArtists(names: string[]) {
  // Two entries for the same new name would both try to create it and
  // the second would hit the unique constraint on `name`.
  return [...new Set(names)].map((name) => ({
    where: { name },
    create: { name },
  }));
}
