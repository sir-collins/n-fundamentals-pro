import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Song } from '../../songs/entities/song.entity';

/**
 * An artist, related to the songs they appear on via a many-to-many join
 * table TypeORM manages automatically. `Song` owns the relation (it
 * carries `@JoinTable()`); this is just the inverse side.
 */
@ObjectType()
@Entity()
export class Artist {
  @ApiProperty()
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id!: number;

  // Unique so the same artist name can't accidentally become two separate
  // rows — that would defeat the point of normalizing this out of Song.
  @ApiProperty()
  @Field()
  @Column({ unique: true })
  name!: string;

  // Not surfaced in API docs or the GraphQL schema — Song.artists already
  // shows this side of the relation, and exposing both directions would
  // create a circular schema for no benefit (same call as the Swagger step).
  @ManyToMany(() => Song, (song) => song.artists)
  songs!: Song[];
}
