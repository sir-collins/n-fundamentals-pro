import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { Album, Lyrics } from '../generated/prisma/client';
import { isNotFound } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  SongWithArtists,
  toArtists,
  withArtists,
} from '../prisma-songs/prisma-songs.service';
import { CreateSongDto } from '../songs/dto/create-song.dto';
import { BulkUpdateSongsDto } from './dto/bulk-update-songs.dto';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpsertLyricsDto } from './dto/upsert-lyrics.dto';

/**
 * Thrown inside `importSongs`' transaction to roll it back when a title
 * already exists. Not an HTTP exception, so the service stays
 * HTTP-agnostic; the controller maps it to 409.
 */
export class SongTitleConflictError extends Error {
  constructor(readonly title: string) {
    super(`A song titled "${title}" already exists`);
    this.name = 'SongTitleConflictError';
  }
}

// Song count without loading the songs.
const artistDetail = {
  albums: { orderBy: { id: 'asc' } },
  _count: { select: { songs: true } },
} satisfies Prisma.ArtistInclude;

/** Derived from the `include` above so the type and query can't drift. */
export type ArtistDetail = Prisma.ArtistGetPayload<{
  include: typeof artistDetail;
}>;

/**
 * Artist → Albums (one-to-many), Song → Lyrics (one-to-one) and bulk song
 * operations. Returns `null` for "not found", like `PrismaSongsService`.
 */
@Injectable()
export class PrismaRelationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Find an artist with their albums and song count, or `null`. */
  findArtist(id: number): Promise<ArtistDetail | null> {
    return this.prisma.artist.findUnique({
      where: { id },
      include: artistDetail,
    });
  }

  /**
   * Create an album under the artist with `artistId`.
   * @returns the album, or `null` if no artist exists with `artistId`.
   */
  async addAlbum(
    artistId: number,
    createAlbumDto: CreateAlbumDto,
  ): Promise<Album | null> {
    try {
      return await this.prisma.album.create({
        data: { ...createAlbumDto, artist: { connect: { id: artistId } } },
      });
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  /** The lyrics of the song with `songId`, or `null` if it has none. */
  findLyrics(songId: number): Promise<Lyrics | null> {
    return this.prisma.lyrics.findUnique({ where: { songId } });
  }

  /**
   * Create or replace the lyrics of the song with `songId` in one `upsert`
   * (TypeORM would need a find, then an insert or update).
   * @returns the lyrics, or `null` if no song exists with `songId`.
   */
  async upsertLyrics(
    songId: number,
    { text }: UpsertLyricsDto,
  ): Promise<Lyrics | null> {
    try {
      return await this.prisma.lyrics.upsert({
        where: { songId },
        create: { text, song: { connect: { id: songId } } },
        update: { text },
      });
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Add several albums to the artist in one INSERT. Titles the artist
   * already has are skipped (`ON CONFLICT DO NOTHING` on
   * `(artistId, title)`).
   *
   * The artist is checked first: bulk inserts take raw foreign keys, not
   * `connect`, so a missing artist would otherwise surface as a
   * foreign-key error (P2003) instead of P2025.
   * @returns the albums created (skipped ones excluded), or `null` if no
   *   artist exists with `artistId`.
   */
  async addAlbums(
    artistId: number,
    albums: CreateAlbumDto[],
  ): Promise<Album[] | null> {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
      select: { id: true },
    });

    if (!artist) {
      return null;
    }

    return this.prisma.album.createManyAndReturn({
      data: albums.map(({ title, releaseDate }) => ({
        title,
        releaseDate,
        artistId,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Apply the same change to every song in `ids` in one UPDATE. Unknown ids
   * are not counted; unlike `update`, `updateMany` doesn't throw P2025.
   * @returns how many songs were updated.
   */
  updateSongs({
    ids,
    releaseDate,
    duration,
  }: BulkUpdateSongsDto): Promise<{ count: number }> {
    // Fields picked rather than spread, so only these two can ever be
    // written. `undefined` ones are left unchanged.
    return this.prisma.song.updateMany({
      where: { id: { in: [...new Set(ids)] } },
      data: { releaseDate, duration },
    });
  }

  /**
   * Delete every artist with no songs and no albums in one DELETE. The
   * `albums: none` filter is required: albums restrict their artist's
   * delete, so one match with albums would fail the whole statement (P2003).
   * @returns how many artists were deleted.
   */
  deleteOrphanArtists(): Promise<{ count: number }> {
    return this.prisma.artist.deleteMany({
      where: { songs: { none: {} }, albums: { none: {} } },
    });
  }

  /**
   * Import several songs with their artists, all or nothing, in one
   * interactive transaction. A single statement isn't possible:
   * `createMany` has no `connectOrCreate`, and the implicit `_ArtistToSong`
   * join table isn't a model, so it's one nested `create` per song.
   *
   * Titles are checked through `tx`, so earlier songs in the same batch
   * count too. Every query must use `tx`: one sent through `this.prisma`
   * runs outside the transaction and survives a rollback. 100 songs (the
   * DTO's cap) stay well inside Prisma's 5-second transaction timeout.
   * @returns the created songs, in input order.
   * @throws SongTitleConflictError if any title already exists (nothing is
   *   written).
   */
  importSongs(songs: CreateSongDto[]): Promise<SongWithArtists[]> {
    return this.prisma.$transaction(async (tx) => {
      const created: SongWithArtists[] = [];

      // Fields picked rather than spread, so a body can never set `id`.
      for (const { title, releaseDate, duration, artists } of songs) {
        const existing = await tx.song.findFirst({
          where: { title },
          select: { id: true },
        });

        if (existing) {
          throw new SongTitleConflictError(title);
        }

        created.push(
          await tx.song.create({
            data: {
              title,
              releaseDate,
              duration,
              artists: { connectOrCreate: toArtists(artists) },
            },
            include: withArtists,
          }),
        );
      }

      return created;
    });
  }
}
