import { Directive, Field, Int, ObjectType } from '@nestjs/graphql';
import { PUBLIC_CACHE_HINT } from '../../common/cache-control';

/**
 * An artist's profile, fetched live from Deezer (see `DeezerService`).
 * Needs the public cache hint: Apollo uses the lowest maxAge in a response,
 * so an unhinted type would make any query selecting `profile` uncacheable.
 */
@ObjectType()
@Directive(PUBLIC_CACHE_HINT)
export class ArtistProfile {
  @Field(() => Int)
  deezerId!: number;

  @Field()
  link!: string;

  @Field()
  pictureUrl!: string;

  @Field(() => Int)
  fans!: number;

  @Field(() => Int)
  albums!: number;
}
