import { Directive, Field, Int, ObjectType } from '@nestjs/graphql';
import { PUBLIC_CACHE_HINT } from '../../common/cache-control';

/**
 * An artist's public profile, fetched live from Deezer rather than stored
 * here (see `DeezerService`). Public, same-for-everyone data, so it carries
 * the public cache hint — without it, this unhinted object type would make
 * any query selecting `profile` uncacheable (Apollo's lowest-maxAge rule).
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
