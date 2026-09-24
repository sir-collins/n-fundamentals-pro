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
 * logic duplicated here.
 *
 * Deliberately simpler than the REST controller for now: mutations are
 * unguarded (GraphQL auth is its own later roadmap step — "re-implement
 * auth"), and "not found" resolves to `null` (GraphQL's own idiom for a
 * missing single-item result) rather than a REST-style thrown 404 —
 * proper GraphQL error handling is also its own later step.
 */
@Resolver(() => Song)
export class SongsResolver {
  constructor(private readonly songsService: SongsService) {}

  @Query(() => PaginatedSongs)
  songs(@Args() pagination: PaginationQueryDto): Promise<PaginatedSongs> {
    return this.songsService.findAll(pagination);
  }

  @Query(() => Song, { nullable: true })
  song(@Args('id', { type: () => Int }) id: number): Promise<Song | null> {
    return this.songsService.findOne(id);
  }

  @Mutation(() => Song)
  createSong(@Args('input') input: CreateSongDto): Promise<Song> {
    return this.songsService.create(input);
  }

  @Mutation(() => Song, { nullable: true })
  updateSong(
    @Args('id', { type: () => Int }) id: number,
    @Args('input') input: UpdateSongInput,
  ): Promise<Song | null> {
    return this.songsService.update(id, input);
  }

  @Mutation(() => Boolean)
  deleteSong(@Args('id', { type: () => Int }) id: number): Promise<boolean> {
    return this.songsService.remove(id);
  }
}
