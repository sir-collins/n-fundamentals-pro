import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { Artist, Song } from '../generated/prisma/client';
import { isNotFound } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSongDto } from '../songs/dto/create-song.dto';
import { PaginationQueryDto } from '../songs/dto/pagination-query.dto';
import { UpdateSongInput } from '../songs/dto/update-song.input';
import { Paginated } from '../songs/songs.service';

export type SongWithArtists = Song & { artists: Artist[] };

// Every query loads artists so responses match GET /songs exactly.
export const withArtists = { artists: true } as const;

/**
 * Prisma counterpart of `SongsService`: same inputs, outputs and
 * `null`/`false` for "not found", so the two controllers stay comparable.
 * Artist names are resolved by a nested `connectOrCreate` instead of an
 * `ArtistsService`.
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
    // Prisma has no findAndCount, so page and total are two queries.
    // RepeatableRead gives both the same snapshot; under the default Read
    // Committed a concurrent insert could make `data` and `total` disagree.
    // `orderBy` keeps pages stable across requests.
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.song.findMany({
          include: withArtists,
          orderBy: { id: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.song.count(),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    return { data, total };
  }

  /** Find a song by id, or `null` if none exists. */
  findOne(id: number): Promise<SongWithArtists | null> {
    return this.prisma.song.findUnique({ where: { id }, include: withArtists });
  }

  /**
   * Update the supplied fields in one query (TypeORM loads, merges, then
   * saves). Supplied `artists` replace the current ones: `set: []` clears
   * the links first, otherwise `connectOrCreate` would only add.
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

/** Artist names to `connectOrCreate` entries. */
export function toArtists(names: string[]) {
  // Deduplicated: two entries for the same new name would both try to
  // create it, and the second would violate the unique constraint.
  return [...new Set(names)].map((name) => ({
    where: { name },
    create: { name },
  }));
}
