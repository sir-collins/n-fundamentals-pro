import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A song as stored in Postgres. Unlike `CreateSongDto` (client input), this
 * includes the database-assigned `id`.
 */
@Entity()
export class Song {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  // Postgres has no native "array of strings" scalar TypeORM maps to by
  // default — simple-array stores it as a comma-separated string and
  // transparently converts it back to string[] on read.
  @Column('simple-array')
  artists!: string[];

  @Column()
  releaseDate!: string;

  @Column()
  duration!: string;
}
