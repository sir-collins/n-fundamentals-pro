import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Directive, Field, Int, ObjectType } from '@nestjs/graphql';
import { PUBLIC_CACHE_HINT } from '../../common/cache-control';
import { Song } from '../../songs/entities/song.entity';

/** An artist. Inverse side of the many-to-many owned by `Song.artists`. */
@ObjectType()
@Directive(PUBLIC_CACHE_HINT)
@Entity()
export class Artist {
  @ApiProperty()
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id!: number;

  // Unique so one name never becomes two artist rows.
  @ApiProperty()
  @Field()
  @Column({ unique: true })
  name!: string;

  // Not exposed in Swagger or GraphQL: Song.artists already covers the
  // relation, and both directions would make the schema circular.
  // TypeORM takes the join table's artistId foreign-key rules from this
  // side; without the CASCADE options they would default to NO ACTION and
  // no longer match the InitialSchema migration.
  @ManyToMany(() => Song, (song) => song.artists, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  songs!: Song[];
}
