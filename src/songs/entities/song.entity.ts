import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Artist } from '../../artists/entities/artist.entity';

/**
 * A song as stored in Postgres. Unlike `CreateSongDto` (client input), this
 * includes the database-assigned `id` and real `Artist` rows.
 */
@Entity()
export class Song {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  // Owning side of the many-to-many relation — @JoinTable() creates and
  // manages the join table pairing song_id/artist_id. Not loaded by
  // default; repository calls must ask for it via relations: ['artists'].
  @ManyToMany(() => Artist)
  @JoinTable()
  artists!: Artist[];

  @Column()
  releaseDate!: string;

  @Column()
  duration!: string;
}
