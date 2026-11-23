import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Directive, Field, Int, ObjectType } from '@nestjs/graphql';
import { PUBLIC_CACHE_HINT } from '../../common/cache-control';
import { Artist } from '../../artists/entities/artist.entity';

/**
 * A song row in Postgres. The same class serves as the TypeORM entity, the
 * Swagger model and the GraphQL type, so the three can't drift apart.
 */
@ObjectType()
@Directive(PUBLIC_CACHE_HINT)
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

  // Owning side of the relation. Not loaded by default: queries must ask
  // for `relations: { artists: true }`.
  @ApiProperty({ type: () => Artist, isArray: true })
  @Field(() => [Artist])
  @ManyToMany(() => Artist, (artist) => artist.songs)
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
