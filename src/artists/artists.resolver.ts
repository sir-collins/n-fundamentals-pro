import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Artist } from './entities/artist.entity';
import { ArtistProfile } from './dto/artist-profile.type';
import type { GqlContext } from '../common/graphql-context';

/**
 * GraphQL fields on `Artist` that don't live in Postgres. `profile` comes
 * from Deezer, live, and only when a client asks for it.
 */
@Resolver(() => Artist)
export class ArtistsResolver {
  /**
   * `null` when Deezer has no exactly-matching artist. If Deezer itself
   * fails, this field alone becomes `null` with an entry in `errors[]` —
   * the rest of the response (songs, other artists) still comes back.
   */
  @ResolveField(() => ArtistProfile, { nullable: true })
  profile(
    @Parent() artist: Artist,
    @Context() context: GqlContext,
  ): Promise<ArtistProfile | null> {
    return context.loaders.artistProfile.load(artist.name);
  }
}
