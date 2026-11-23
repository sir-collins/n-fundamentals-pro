import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Song } from '../songs/entities/song.entity';
import { Artist } from '../artists/entities/artist.entity';
import { User } from '../users/entities/user.entity';
import { ApiKey } from '../auth/entities/api-key.entity';

/**
 * DataSource for the TypeORM migration CLI, which runs outside Nest and so
 * reads `.env` through dotenv instead of `ConfigService`.
 */
// The only export: the CLI refuses a file with more than one exported
// DataSource, and a named export of the same object counts as a second.
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [Song, Artist, User, ApiKey],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
