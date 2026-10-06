import { NotFoundException, UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song-dto';
import { UpdateSongInput } from './dto/update-song.input';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PaginatedSongs } from './dto/paginated-songs.type';
import { Song } from './entities/song.entity';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { Artist } from '../artists/entities/artist.entity';
import type { GqlContext } from '../common/graphql-context';

/**
 * GraphQL layer for `songs` — a second API surface over the exact same
 * `SongsService` the REST `SongsController` already uses, no business
 * logic duplicated here. `NotFoundException` thrown below is formatted
 * for GraphQL by `HttpExceptionFilter` (same class, same messages as
 * `SongsController`'s REST equivalents) rather than a REST-style thrown
 * response object.
 *
 * Mutations are guarded exactly like their REST equivalents —
 * `GqlAuthGuard` (JWT, GraphQL's counterpart to `AuthGuard('jwt')`) then
 * `RolesGuard`, same order/pairing as `SongsController`.
 */
@Resolver(() => Song)
export class SongsResolver {
  constructor(private readonly songsService: SongsService) {}

  @Query(() => PaginatedSongs)
  songs(@Args() pagination: PaginationQueryDto): Promise<PaginatedSongs> {
    return this.songsService.findAll(pagination, { withArtists: false });
  }

  /** @throws NotFoundException if no song exists with `id`. */
  @Query(() => Song)
  async song(@Args('id', { type: () => Int }) id: number): Promise<Song> {
    const song = await this.songsService.findOne(id, {
      withArtists: false,
    });

    if (!song) {
      throw new NotFoundException(`Song with id ${id} was not found`);
    }

    return song;
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Mutation(() => Song)
  createSong(@Args('input') input: CreateSongDto): Promise<Song> {
    return this.songsService.create(input);
  }

  /** @throws NotFoundException if no song exists with `id`. */
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
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
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
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

  /**
   * Resolved per song, but batched: every call made while building one
   * response goes through the same per-request DataLoader, so a page of N
   * songs costs one artists query, not N. Songs from the mutations
   * already carry their artists and skip the loader entirely.
   */
  @ResolveField(() => [Artist])
  artists(
    @Parent() song: Song,
    @Context() context: GqlContext,
  ): Artist[] | Promise<Artist[]> {
    return song.artists ?? context.loaders.artistsBySong.load(song.id);
  }
}
