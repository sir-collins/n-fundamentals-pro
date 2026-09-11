import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Artist } from '../../artists/entities/artist.entity';

/**
 * A song as stored in Postgres. Unlike `CreateSongDto` (client input), this
 * includes the database-assigned `id` and real `Artist` rows.
 */
@Entity()
export class Song {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty()
  @Column()
  title!: string;

  // Owning side of the many-to-many relation — @JoinTable() creates and
  // manages the join table pairing song_id/artist_id. Not loaded by
  // default; repository calls must ask for it via relations: ['artists'].
  @ApiProperty({ type: () => Artist, isArray: true })
  @ManyToMany(() => Artist)
  @JoinTable()
  artists!: Artist[];

  @ApiProperty({ example: '2024-01-15' })
  @Column()
  releaseDate!: string;

  @ApiProperty({ example: '03:45' })
  @Column()
  duration!: string;
}
