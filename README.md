# n-fundamentals-pro

A hands-on NestJS learning project: one evolving API, built step by step
across a project-based roadmap (freeCodeCamp's "Learn NestJS" course),
rather than a bunch of disconnected tutorial snippets.

At its centre is a music catalog: **songs** and **artists** (many-to-many),
with auth, comments, real-time updates and a GraphQL API layered on top.
The same catalog is also built twice, once with **TypeORM** and once with
**Prisma**, to compare the two. Every step is documented in
[`docs/`](./docs): the roadmap, a progress checklist, and a build journal
explaining *why* each piece was built the way it was. Start at
[`docs/README.md`](./docs/README.md).

## What's in it

| Area | What it does | Where |
|---|---|---|
| **REST songs** | Validated, paginated CRUD; artists created by name on first use | `src/songs/`, `src/artists/` |
| **Auth** | Signup/login with JWT, `admin`/`user` roles, TOTP two-factor auth (with replay protection), API keys | `src/auth/`, `src/users/` |
| **Comments** | Threaded comments on songs, stored in **MongoDB** (polyglot persistence) | `src/comments/` |
| **Real time** | Live comment notifications over **WebSockets** (Socket.IO) | `src/comments/`, [`public/realtime-comments.html`](./public/realtime-comments.html) |
| **GraphQL** | A code-first API at `/graphql` over the same services: queries, guarded mutations, a `commentAdded` subscription, **DataLoader** batching, Apollo **response caching**, and artist profiles fetched live from **Deezer's** API | `*.resolver.ts`, [`schema.gql`](./schema.gql), [`public/graphql-comment-subscriptions.html`](./public/graphql-comment-subscriptions.html) |
| **Prisma rebuild** | `/prisma/songs` mirrors `/songs` on Prisma, plus albums (one-to-many), lyrics (one-to-one), bulk operations and an all-or-nothing import (interactive transaction) | `src/prisma*/`, [`prisma/schema.prisma`](./prisma/schema.prisma) |

The Prisma vs TypeORM comparison, including the SQL each ORM actually
sends, is written up in
[`docs/04-prisma-vs-typeorm.md`](./docs/04-prisma-vs-typeorm.md).

## Stack

- **NestJS 11**: controllers, services and modules; pipes, guards,
  exception filters, middleware
- **PostgreSQL 16**, through two ORMs side by side:
  - **TypeORM** (schema `public`), with committed migrations
    (`src/database/migrations/`)
  - **Prisma 7** (schema `prisma`, pinned to 7.10.0), with its own
    migrations (`prisma/migrations/`) and the `pg` driver adapter
- **MongoDB** via **Mongoose**, for comments
- **Passport** (`local` + `jwt`), **bcrypt**, **otplib** + **qrcode**
- **Swagger/OpenAPI** (`@nestjs/swagger`)
- **Socket.IO** WebSockets, and **GraphQL** with Apollo (`graphql-ws` for
  subscriptions)
- **Jest** + **supertest** for unit and E2E tests
- Postgres and MongoDB run locally through `docker-compose.yml`

## Getting started

```bash
# 1. Start Postgres + MongoDB
docker compose up -d

# 2. Configure: the defaults match docker-compose.yml
cp .env.example .env

# 3. Install. This also runs `prisma generate` (postinstall),
#    which writes the Prisma client to src/generated/prisma (gitignored)
npm install

# 4. Create the tables: TypeORM's, then Prisma's
npm run migration:run
npx prisma migrate deploy

# 5. Optional: sample songs and artists
npm run seed

# 6. Run in watch mode
npm run start:dev
```

The app listens on `http://localhost:3000` (or `PORT`).

### Environment variables

Every value is validated at boot (`src/config/env.validation.ts`). A
missing or malformed one stops the app with a clear error instead of
failing later.

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default `3000`) |
| `JWT_SECRET` | Signs access tokens |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | Postgres, used by **both** TypeORM and Prisma. Prisma's CLI builds its URL from these in [`prisma.config.ts`](./prisma.config.ts), so there's no separate `DATABASE_URL` |
| `MONGO_URI` | MongoDB, for comments |
| `NODE_ENV` | `development` / `production` / `test` (default `development`) |
| `ENABLE_SWAGGER` | Serve the docs at `/api` (default `true`) |
| `DEEZER_API_URL` | Base URL for artist profiles (default `https://api.deezer.com`) |

None of these are committed per environment (there's no `.env.production`).
A real deployment sets its own values in its host's dashboard.

### Other run modes

- `npm run start:debug`: opens Node's inspector on port `9229`. Pairs with
  the "Attach to Nest" config in `.vscode/launch.json`.
- `npm run start:hmr`: webpack Hot Module Reloading.
- `npm run start:swc`: SWC compilation (fast), plus a parallel
  `tsc --noEmit` so type errors are still caught.
- `npm run build && npm run start:prod`: the production build.

### Schema changes

| | TypeORM | Prisma |
|---|---|---|
| Generate a migration | `npm run migration:generate -- src/database/migrations/<Name>` | `npx prisma migrate dev --name <name>` |
| Apply | `npm run migration:run` | `npx prisma migrate deploy` |
| Status | `npm run typeorm -- migration:show -d src/database/data-source.ts` | `npx prisma migrate status` |

Review the generated SQL before applying it. Each ORM owns its own
Postgres schema (`public` and `prisma`) and must never touch the other's.
Prisma Migrate treats tables it didn't create as drift.

## Exploring the API

- **Swagger UI:** http://localhost:3000/api (raw spec at `/api-json`).
  The **Authorize** button takes either a **bearer** JWT from
  `POST /auth/login` (no `Bearer ` prefix) or an **api-key** from
  `POST /auth/api-keys`, sent as `x-api-key`. A good first pass: sign up,
  log in, authorize, try `GET /auth/profile`, mint an API key, then try
  `GET /auth/api-keys/whoami` with it.
- **GraphQL:** http://localhost:3000/graphql
- **Real-time demos:** `/realtime-comments.html` (WebSockets) and
  `/graphql-comment-subscriptions.html` (GraphQL subscriptions), served
  from `public/`.
- **REST Client:** [`rest-client.http`](./rest-client.http) holds
  ready-to-run requests for VS Code's REST Client extension.

Writes to songs (on both ORMs) need an `admin`. New accounts are `user`s,
so promote one directly in Postgres for local testing:
`UPDATE "user" SET role = 'admin' WHERE email = '…';`

## Testing

```bash
npm test             # unit tests
npm run test:e2e     # E2E tests (run in band)
npm run test:cov     # coverage
```

The **E2E suites run against the real Postgres and MongoDB from `.env`**,
so Docker must be up and both sets of migrations applied. Each suite
stamps its data (`E2E … <timestamp>`) and deletes it afterwards. One
exception: `DELETE /prisma/artists/orphans` removes *every* orphaned
Prisma artist, so run the suites against a dev database, never one with
data you care about.

Notable suites:
- `test/rest.e2e-spec.ts` and `test/graphql.e2e-spec.ts`: the two API
  surfaces, including real TOTP codes and API keys
- `test/prisma*.e2e-spec.ts`: the Prisma routes, relations, bulk
  operations and transactions (rollback checked against the database itself)
- `test/songs-parity.e2e-spec.ts`: the same scenarios against `/songs`
  *and* `/prisma/songs`, holding the two ORMs to identical behaviour

## Deployment

The app was deployed to **Railway** in Project 6 (its own Postgres and
MongoDB, configured through Railway's dashboard; see
[`railway.json`](./railway.json) and `docs/03-journal.md`). As of
2026-11-06 the Railway service is **paused**, and its URL returns
*"Application not found"*. Prisma's migrations were never applied there
either: the Prisma work (Project 9) is local-only.

Merges to `master` no longer trigger a deploy. `railway.json` sets
`build.watchPatterns` to `/.railway-deploy`, a file that doesn't exist,
and Railway only deploys a push that changes a file matching the pattern.
To deploy again, either create or edit `.railway-deploy` in a commit, or
remove `watchPatterns`. Then apply both sets of migrations on Railway's
Postgres.

## Project status

| # | Project | Status |
|---|---|---|
| 1 | Your First REST API | ✅ |
| 2 | Add a Real Database (TypeORM) | ✅ |
| 3 | Authentication & Authorization | ✅ |
| 4 | Production-Grade Setup | ✅ |
| 5 | Add MongoDB Alongside SQL | ✅ |
| 6 | Ship It (environments, Railway, testing) | ✅ |
| 7 | Real-Time Layer (WebSockets) | ✅ |
| 8 | GraphQL API | ✅ |
| 9 | Rebuild the Data Layer with Prisma | ✅ |
| 10 | Capstone: Advanced Feature Grab Bag | Not started |

The live checklist, with notes on how each item was done, is
[`docs/01-progress.md`](./docs/01-progress.md). The full roadmap is
[`docs/00-roadmap.md`](./docs/00-roadmap.md).
