import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Song } from '../entities/song.entity';

/**
 * The `songs` query's return type — mirrors `Paginated<Song>`
 * (`songs.service.ts`)'s `{ data, total }` shape. A plain TS interface
 * generic isn't usable as a GraphQL return type on its own; this is the
 * concrete `@ObjectType()` GraphQL needs.
 */
@ObjectType()
export class PaginatedSongs {
  @Field(() => [Song])
  data!: Song[];

  @Field(() => Int)
  total!: number;
}
