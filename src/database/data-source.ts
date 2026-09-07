import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Song } from '../songs/entities/song.entity';
import { Artist } from '../artists/entities/artist.entity';
import { User } from '../users/entities/user.entity';
import { ApiKey } from '../auth/entities/api-key.entity';

/**
 * Config for TypeORM's CLI only (`migration:generate`/`run`/`revert` in
 * package.json) — the CLI runs outside Nest entirely, so it can't inject
 * `ConfigService` the way `app.module.ts`'s `TypeOrmModule.forRootAsync`
 * does. `dotenv/config` loads the same `.env` file directly instead; no
 * Joi validation here since this is a dev-only tool, not a served app.
 *
 * `synchronize: false` always — this DataSource exists specifically to
 * generate/run migrations, so letting it auto-sync would defeat the
 * point.
 */
// A single export, deliberately — TypeORM's CLI loader
// ("typeorm-ts-node-commonjs") requires the file to contain exactly one
// exported DataSource instance; a named export alongside `export default`
// of the same object counts as two and the CLI refuses to load it.
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
