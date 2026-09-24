import { NotFoundException } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song-dto';
import { UpdateSongInput } from './dto/update-song.input';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PaginatedSongs } from './dto/paginated-songs.type';
import { Song } from './entities/song.entity';

/**
 * GraphQL layer for `songs` — a second API surface over the exact same
 * `SongsService` the REST `SongsController` already uses, no business
 * logic duplicated here. `NotFoundException` thrown below is formatted
 * for GraphQL by `HttpExceptionFilter` (same class, same messages as
 * `SongsController`'s REST equivalents) rather than a REST-style thrown
 * response object.
 *
 * Deliberately simpler than the REST controller in one remaining way:
 * mutations are unguarded (GraphQL auth is its own later roadmap step —
 * "re-implement auth").
 */
@Resolver(() => Song)
export class SongsResolver {
  constructor(private readonly songsService: SongsService) {}

  @Query(() => PaginatedSongs)
  songs(@Args() pagination: PaginationQueryDto): Promise<PaginatedSongs> {
    return this.songsService.findAll(pagination);
  }

  /** @throws NotFoundException if no song exists with `id`. */
  @Query(() => Song)
  async song(@Args('id', { type: () => Int }) id: number): Promise<Song> {
    const song = await this.songsService.findOne(id);

    if (!song) {
      throw new NotFoundException(`Song with id ${id} was not found`);
    }

    return song;
  }

  @Mutation(() => Song)
  createSong(@Args('input') input: CreateSongDto): Promise<Song> {
    return this.songsService.create(input);
  }

  /** @throws NotFoundException if no song exists with `id`. */
  @Mutation(() => Song)
  async updateSong(
    @Args('id', { type: () => Int }) id: number,
    @Args('input') input: UpdateSongInput,
  ): Promise<Song> {
    const song = await this.songsService.update(id, input);

    if (!song) {
      throw new NotFoundException(`Song with id ${id} was not found`);
    }

    return song;
  }

  /** @throws NotFoundException if no song exists with `id`. */
  @Mutation(() => Boolean)
  async deleteSong(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    const removed = await this.songsService.remove(id);

    if (!removed) {
      throw new NotFoundException(`Song with id ${id} was not found`);
    }

    return true;
  }
}
