import { Directive, Field, Int, ObjectType } from '@nestjs/graphql';
import { PUBLIC_CACHE_HINT } from '../../common/cache-control';
import { Song } from '../entities/song.entity';

/**
 * The `songs` query's return type. Mirrors the `Paginated<Song>` interface,
 * which GraphQL can't use because it isn't a class.
 */
@ObjectType()
@Directive(PUBLIC_CACHE_HINT)
export class PaginatedSongs {
  @Field(() => [Song])
  data!: Song[];

  @Field(() => Int)
  total!: number;
}
