import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Artist } from '../../artists/entities/artist.entity';

/**
 * A song as stored in Postgres. Unlike `CreateSongDto` (client input), this
 * includes the database-assigned `id` and real `Artist` rows.
 *
 * `@ObjectType()`/`@Field()` sit alongside the existing `@ApiProperty()`s
 * the same way — one class, two API layers (REST via Swagger, GraphQL via
 * this), no separate GraphQL-only type to keep in sync.
 */
@ObjectType()
@Entity()
export class Song {
  @ApiProperty()
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty()
  @Field()
  @Column()
  title!: string;

  // Owning side of the many-to-many relation — @JoinTable() creates and
  // manages the join table pairing song_id/artist_id. Not loaded by
  // default; repository calls must ask for it via relations: ['artists'].
  @ApiProperty({ type: () => Artist, isArray: true })
  @Field(() => [Artist])
  @ManyToMany(() => Artist)
  @JoinTable()
  artists!: Artist[];

  @ApiProperty({ example: '2024-01-15' })
  @Field()
  @Column()
  releaseDate!: string;

  @ApiProperty({ example: '03:45' })
  @Field()
  @Column()
  duration!: string;
}
