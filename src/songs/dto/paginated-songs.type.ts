import { Directive, Field, Int, ObjectType } from '@nestjs/graphql';
import { PUBLIC_CACHE_HINT } from '../../common/cache-control';
import { Song } from '../entities/song.entity';

/**
 * The `songs` query's return type — mirrors `Paginated<Song>`
 * (`songs.service.ts`)'s `{ data, total }` shape. A plain TS interface
 * generic isn't usable as a GraphQL return type on its own; this is the
 * concrete `@ObjectType()` GraphQL needs.
 */
@ObjectType()
@Directive(PUBLIC_CACHE_HINT)
export class PaginatedSongs {
  @Field(() => [Song])
  data!: Song[];

  @Field(() => Int)
  total!: number;
}
