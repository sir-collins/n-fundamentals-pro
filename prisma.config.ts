import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Config for Prisma's CLI (`migrate`, `generate`, `studio`) — the
 * counterpart to `src/database/data-source.ts` for TypeORM's CLI. Like
 * that file, it runs outside Nest, so it loads `.env` via `dotenv/config`
 * rather than `ConfigService`.
 *
 * The URL is built from the same `DB_*` variables the app already uses,
 * so there's no separate `DATABASE_URL` to keep in sync. `?schema=prisma`
 * keeps everything Prisma Migrate creates out of TypeORM's "public"
 * schema (see prisma/schema.prisma for why that matters). The running app
 * doesn't read this file — PrismaService sets the same schema on its
 * driver adapter.
 */
const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME } = process.env;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: `postgresql://${encodeURIComponent(DB_USERNAME ?? '')}:${encodeURIComponent(DB_PASSWORD ?? '')}@${DB_HOST}:${DB_PORT ?? 5432}/${DB_NAME}?schema=prisma`,
  },
});
