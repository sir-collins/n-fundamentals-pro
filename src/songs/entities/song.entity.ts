/**
 * A song as stored server-side. Unlike `CreateSongDto` (client input),
 * this includes the server-assigned `id`.
 */
export class Song {
  id!: number;
  title!: string;
  artists!: string[];
  releaseDate!: string;
  duration!: string;
}
