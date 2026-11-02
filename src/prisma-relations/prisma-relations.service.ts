import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { Album, Lyrics } from '../generated/prisma/client';
import { isNotFound } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { BulkUpdateSongsDto } from './dto/bulk-update-songs.dto';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpsertLyricsDto } from './dto/upsert-lyrics.dto';

// One query: the artist, their albums (one-to-many, in a stable order) and
// a count of their songs (many-to-many) — without loading the songs.
const artistDetail = {
  albums: { orderBy: { id: 'asc' } },
  _count: { select: { songs: true } },
} satisfies Prisma.ArtistInclude;

/**
 * An artist as `findArtist` returns it. Derived from the `include` above
 * rather than written out, so the type and the query can't drift apart.
 */
export type ArtistDetail = Prisma.ArtistGetPayload<{
  include: typeof artistDetail;
}>;

/**
 * The two relation types Project 2 never had, Prisma-style (Project 9):
 * Artist → Albums (one-to-many) and Song → Lyrics (one-to-one). Same
 * conventions as `PrismaSongsService` — `null` for "not found".
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
   * Create an album under the artist with `artistId`. `connect` sets the
   * foreign key from the relation's side — `artistId` itself could be
   * written directly too, but `connect` is what nests inside other writes.
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

  /**
   * The lyrics of the song with `songId`, or `null` if it has none.
   * `songId` is `@unique`, which is what makes it usable in `findUnique`.
   */
  findLyrics(songId: number): Promise<Lyrics | null> {
    return this.prisma.lyrics.findUnique({ where: { songId } });
  }

  /**
   * Set the lyrics of the song with `songId`: create them on the first
   * call, replace the text after that. One `upsert`, where TypeORM would
   * need a find followed by an insert or an update.
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
   * Add several albums to the artist with `artistId` in one INSERT.
   * Albums the artist already has (same title) are skipped, not errors:
   * `skipDuplicates` is `ON CONFLICT DO NOTHING` on the
   * `(artistId, title)` unique key.
   *
   * The artist is looked up first because bulk inserts take raw columns —
   * no `connect`, so Prisma doesn't check the artist itself, and a missing
   * one would surface as the database's foreign-key error (P2003) rather
   * than the P2025 `addAlbum` gets.
   * @returns the albums actually created (skipped ones aren't returned),
   *   or `null` if no artist exists with `artistId`.
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

    // createManyAndReturn (Postgres) where createMany would give a count.
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
   * Apply the same change to every song in `ids`, in one UPDATE. Ids with
   * no song are simply not counted — unlike `update`, `updateMany` doesn't
   * throw P2025.
   * @returns how many songs were updated.
   */
  updateSongs({
    ids,
    releaseDate,
    duration,
  }: BulkUpdateSongsDto): Promise<{ count: number }> {
    // Fields picked, never spread: the global ValidationPipe doesn't strip
    // unknown properties, so a spread body could write `title` to them all.
    // `undefined` ones are left unchanged.
    return this.prisma.song.updateMany({
      where: { id: { in: [...new Set(ids)] } },
      data: { releaseDate, duration },
    });
  }

  /**
   * Delete every artist with no songs and no albums, in one DELETE. Fixes
   * Project 2's known gap: an artist taken off every song stayed behind.
   * The `albums: none` half is required, not tidiness — albums Restrict
   * their artist's delete, so one orphan with albums would fail the whole
   * statement (P2003).
   * @returns how many artists were deleted.
   */
  deleteOrphanArtists(): Promise<{ count: number }> {
    return this.prisma.artist.deleteMany({
      where: { songs: { none: {} }, albums: { none: {} } },
    });
  }
}
