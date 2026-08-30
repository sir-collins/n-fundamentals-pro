import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Song } from '../../songs/entities/song.entity';

/**
 * An artist, related to the songs they appear on via a many-to-many join
 * table TypeORM manages automatically. `Song` owns the relation (it
 * carries `@JoinTable()`); this is just the inverse side.
 */
@Entity()
export class Artist {
  @PrimaryGeneratedColumn()
  id!: number;

  // Unique so the same artist name can't accidentally become two separate
  // rows — that would defeat the point of normalizing this out of Song.
  @Column({ unique: true })
  name!: string;

  @ManyToMany(() => Song, (song) => song.artists)
  songs!: Song[];
}
