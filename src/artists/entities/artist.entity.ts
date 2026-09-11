import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Song } from '../../songs/entities/song.entity';

/**
 * An artist, related to the songs they appear on via a many-to-many join
 * table TypeORM manages automatically. `Song` owns the relation (it
 * carries `@JoinTable()`); this is just the inverse side.
 */
@Entity()
export class Artist {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id!: number;

  // Unique so the same artist name can't accidentally become two separate
  // rows — that would defeat the point of normalizing this out of Song.
  @ApiProperty()
  @Column({ unique: true })
  name!: string;

  // Not surfaced in API docs — Song.artists already shows this side of the
  // relation, and Artist has no controller of its own to return `songs` on.
  @ManyToMany(() => Song, (song) => song.artists)
  songs!: Song[];
}
