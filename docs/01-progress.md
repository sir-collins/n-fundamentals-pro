# Progress

Tracking status against [00-roadmap.md](./00-roadmap.md). Resource used
throughout Project 1: `songs`.

## Project 1: Your First REST API — ✅ Done

- [x] Set up a NestJS project, understand the folder structure
- [x] Build a Controller + Service + Module (the core NestJS trio)
      — `src/songs/songs.controller.ts`, `songs.service.ts`, `songs.module.ts`
- [x] Add Middleware (a request logger)
      — `src/common/middleware/logger/logger.middleware.ts`, wired in
      `app.module.ts` via `MiddlewareConsumer`
- [x] Add an Exception Filter for consistent error responses
      — `src/common/filters/http-exception.filter.ts`, registered globally in
      `main.ts`. Every error response (ours and Nest's own, e.g. a failed
      `ParseIntPipe`) comes back as
      `{ statusCode, timestamp, path, message }`
- [x] Use `ParseIntPipe` to validate route params
      — `:id` on `findOne`/`update`/`delete` in `songs.controller.ts`
- [x] Use `class-validator` to validate request bodies (DTOs)
      — `src/songs/dto/create-song-dto.ts`, enforced globally via
      `ValidationPipe` in `main.ts`

**Outcome achieved:** validated CRUD on an in-memory array of `Song` entities
(`src/songs/entities/song.entity.ts`), each with a real server-assigned
numeric `id` — `create` returns the created song (so the client learns its
`id`), and `update`/`delete` actually persist changes instead of just
existence-checking.

## Project 2: Add a Real Database — ✅ Done

Swap `SongsService`'s in-memory array for Postgres via TypeORM:
- [x] Local Postgres running via Docker — `docker-compose.yml`, started with
      `docker compose up -d`, verified with `pg_isready`
- [x] `@nestjs/typeorm` + `typeorm` + `pg`, `TypeOrmModule.forRoot(...)` wired
      into `AppModule`, connection verified against the Docker Postgres
- [x] A `Song` `@Entity()` replacing the current plain class, with a real
      `@PrimaryGeneratedColumn()` id
- [x] Real CRUD against the DB — `SongsService` now uses an injected
      `Repository<Song>` instead of an array; verified with curl + a direct
      `psql` read, and confirmed data survives a full app restart
- [x] Pagination on `findAll` — `GET /songs?page=&limit=`, response shape
      changed to `{ data, total }`; verified with real multi-page data
- [x] Modeled a relationship — `Artist` entity, many-to-many with `Song`
      via TypeORM's `@ManyToMany()`/`@JoinTable()`. `ArtistsService`
      resolves artist names to real rows, creating them on first use, so
      an artist reused across songs is the same row (verified: "The
      Weeknd" on two songs got one `Artist` row, not two)

**Outcome achieved:** `songs` is fully Postgres-backed — real CRUD,
pagination, and a real many-to-many relationship to a second entity. Known
gap, not pursued (out of scope for this project): an `Artist` removed from
every song it was on stays in the table as an orphaned row — nothing
prunes those yet.

## Project 3: Authentication & Authorization — ✅ Done

- [x] User Signup — `POST /auth/signup`. New `User` entity
      (`src/users/entities/user.entity.ts`); `UsersService.create` hashes
      the password with bcrypt before it ever touches the database, and
      rejects a duplicate email with a `409`. `AuthService.signup` strips
      the hash before returning — a signup response is `{ id, email }`,
      never the hash. Verified: signed up, confirmed the stored value is a
      real bcrypt hash (`$2b$10$...`) via direct `psql`, confirmed a
      duplicate email 409s and bad input (invalid email, short password)
      400s.
- [x] Login — `POST /auth/login`, guarded by Passport's `AuthGuard('local')`.
      New `LocalStrategy` (`src/auth/strategies/local.strategy.ts`)
      validates email/password against the bcrypt hash via
      `AuthService.validateUser`, throwing `UnauthorizedException` on a bad
      pair (Passport turns that into a `401` automatically, before the
      controller body runs). `AuthService.login` issues a JWT (`@nestjs/jwt`,
      wired up via `JwtModule.register(...)` in `AuthModule`) with payload
      `{ sub: id, email }`, returned as `{ access_token }`. Verified: a
      valid login returns a token whose decoded payload is exactly
      `{ sub, email, iat, exp }`; wrong password and an unknown email both
      401; a missing `password` field also 401s (Passport's own
      missing-credentials path, before `LocalStrategy.validate` runs).
- [x] JWT authentication via Passport — `GET /auth/profile`, guarded by
      `AuthGuard('jwt')`, the first route that actually requires a token.
      New `JwtStrategy` (`src/auth/strategies/jwt.strategy.ts`) extracts
      the token from the `Authorization: Bearer ...` header and lets
      Passport verify its signature/expiry before the handler ever runs;
      `validate` trusts the decoded payload directly as `req.user` (no DB
      re-lookup — a deliberate, accepted trade-off: a user changed/deleted
      after a token was issued still passes until that token's own
      expiry). The signing secret is factored into one exported
      `JWT_SECRET` constant in `auth.module.ts`, used by both
      `JwtModule.register(...)` and `JwtStrategy`, so signing and
      verifying can't silently drift onto different values. Verified: no
      token 401s, a garbage token 401s, a fresh login's token returns
      `200` + `{ id, email }` matching that user.
- [x] Role-Based Access Control — `User` gains a `role` column (`'user'`
      default, `'admin'`), enforced structurally: `UsersService.create`
      has no role parameter at all, so nothing signup-shaped can ever hand
      out `'admin'`. New `@Roles(...)` decorator + `RolesGuard`
      (`src/auth/decorators/roles.decorator.ts`,
      `src/auth/guards/roles.guard.ts`) — opt-in per route via metadata,
      `403 Forbidden` (not `401`) on a role mismatch, since the caller
      *is* known, just not allowed. Applied to `songs` mutations (`POST`,
      `PUT`, `DELETE` — now `admin`-only via `AuthGuard('jwt')` +
      `RolesGuard`, in that order); `songs` reads stay fully public.
      Verified: no token 401s a mutation; a real `'user'`-role token 403s
      one; a promoted `'admin'`'s token succeeds on create/update/delete;
      `GET /songs` and `GET /songs/:id` still need no token at all;
      `GET /auth/profile` now surfaces the caller's own role.
- [x] Two-Factor Authentication — `User` gains `twoFactorSecret` (nullable,
      plain text — a known, deliberate gap, same treatment as the JWT
      secret) and `isTwoFactorEnabled` (default `false`). `POST
      /auth/2fa/generate` (JWT-protected) creates a TOTP secret via
      `otplib` and returns it as a scannable QR code; `POST
      /auth/2fa/turn-on` confirms setup with a real code before flipping
      `isTwoFactorEnabled`. **Enforced at login**: `POST /auth/login` for
      a 2FA-enabled account now returns `{ twoFactorRequired: true,
      tempToken }` instead of a real token — a short-lived (5 min) JWT
      that proves the password check just succeeded for that specific
      user, not a client-supplied id (which would let an attacker skip
      the password check). `POST /auth/2fa/authenticate` (deliberately
      unguarded — the caller has no real token yet) exchanges that
      `tempToken` + a TOTP code for a real `access_token`. `JwtStrategy`
      was updated to reject a `tempToken` outright — without that, it
      would work as a full session on any `AuthGuard('jwt')`-protected
      route, silently bypassing 2FA. Verified: a 2FA-enabled login
      returns a `tempToken`, not a token; the real code exchanges it for
      a normal `access_token` (confirmed working on `GET /auth/profile`);
      a wrong code `400`s, a garbage `tempToken` `401`s; critically, a
      *valid* `tempToken` used directly against `GET /auth/profile` also
      `401`s, proving the bypass is actually closed, not just assumed; a
      fresh non-2FA signup still logs in with a direct `access_token`.
- [x] API Key authentication — new `ApiKey` entity
      (`src/auth/entities/api-key.entity.ts`), `ApiKeysService`
      (`src/auth/api-keys.service.ts`), and a deliberately non-Passport
      `ApiKeyGuard` (`src/auth/guards/api-key.guard.ts`). `POST
      /auth/api-keys` (JWT-protected) mints a random 32-byte key, shows
      it exactly once, and stores only its SHA-256 hash (not bcrypt —
      the key is already high-entropy, and SHA-256's determinism is what
      makes a direct indexed lookup possible at all). `GET
      /auth/api-keys` lists a caller's own keys (metadata only); `DELETE
      /auth/api-keys/:id` revokes one, `404`ing identically whether the
      id doesn't exist or belongs to someone else. `GET
      /auth/api-keys/whoami` is guarded by `ApiKeyGuard` alone (no JWT
      at all) and returns the same `{ id, email, role }` shape as `GET
      /auth/profile` — same identity, a different mechanism proving it.
      Verified: minted a key, confirmed only its hash lives in Postgres;
      `whoami` with the raw key matches `/auth/profile`'s response for
      the same user; a garbage key and a missing header both `401`;
      `lastUsedAt` updates on use; after revoking, the same key `401`s
      (not just removed from the list); a second user attempting to
      revoke the first user's key `404`s without leaking that the key
      exists. Completes Project 3.

**Outcome achieved:** a full, layered auth system — password login,
JWT sessions, role-based route restriction, TOTP two-factor
authentication enforced at login, and API keys for machine-to-machine
access — each mechanism verified end to end with real HTTP calls, real
crypto, and (where relevant) a deliberately demonstrated attack proven
closed rather than just asserted to be.

## Project 4: Production-Grade Setup — 🚧 In progress

- [x] Custom configuration + validated environment variables —
      `@nestjs/config` (pinned `^4.0.4` — its latest major, `12.x`, is
      ESM-only and breaks `ts-jest`, same trap as several Project 3
      dependencies) + a Joi schema (`src/config/env.validation.ts`).
      `JWT_SECRET`/`DB_HOST`/`DB_USERNAME`/`DB_PASSWORD`/`DB_NAME` are
      required with no default — a missing one now makes the app refuse
      to boot with a clear error, instead of silently running with
      `undefined`. `PORT`/`DB_PORT` keep sensible defaults (`3000`/`5432`)
      matching prior behavior. `app.module.ts`'s `TypeOrmModule.forRoot`
      and `auth.module.ts`'s `JwtModule.register` both moved to their
      `*Async` forms, reading connection details and `JWT_SECRET` from
      `ConfigService` instead of hardcoded literals; `JwtStrategy` now
      injects `ConfigService` directly rather than importing a shared
      exported constant. `.env` (real dev values, a freshly generated
      random `JWT_SECRET` — not the old placeholder string) is
      gitignored (already covered by an existing `.gitignore` rule);
      `.env.example` is committed with placeholder values. Verified:
      commenting out `JWT_SECRET` in `.env` and rebooting produced a real
      `Config validation error: "JWT_SECRET" is required` before the app
      ever listened (confirmed via `curl` — connection refused, nothing
      bound to the port); restoring `.env` resumed a normal boot;
      signup/login/`GET /auth/profile`/API-key `whoami` all still work
      unchanged, proving both the Postgres connection and JWT
      signing/verification genuinely work through the new config path,
      not just "it compiles"; `PORT=3001` as a shell env var still wins
      over `.env`'s `PORT=3000` (dotenv doesn't override an
      already-set variable), so scratch-port testing is unaffected.
- [ ] Debugging a NestJS app
- [x] Migrations (instead of auto-sync) + Seeding sample data —
      `synchronize: true` → `false` in `app.module.ts`. A separate plain
      `DataSource` (`src/database/data-source.ts`, using `dotenv`
      directly — TypeORM's CLI runs outside Nest's DI and can't inject
      `ConfigService`) backs new `migration:generate`/`run`/`revert` npm
      scripts. The initial migration
      (`src/database/migrations/*-InitialSchema.ts`) was generated
      against a genuinely empty Postgres (`docker compose down -v && up
      -d` — diffing against the old `synchronize`-built DB would've
      produced an empty migration, since it already matched) and
      verified column-for-column identical to the pre-migration schema,
      including matching auto-generated constraint names. A seed script
      (`src/database/seed.ts`, `npm run seed`) uses
      `NestFactory.createApplicationContext` to insert demo rows through
      real service methods (`UsersService.create`, `SongsService.create`)
      rather than raw SQL — one demo user, one promoted to `admin` via a
      direct repository write (the same out-of-band pattern
      `rest-client.http` already documents for real accounts;
      `UsersService.create` deliberately still has no `role` parameter),
      and a sample song. Re-running `npm run seed` skips existing users
      instead of crashing. Verified: full regression pass (signup, login,
      JWT profile, API key `whoami`) against the migration-built schema;
      `migration:revert` genuinely drops every table it created (checked
      via `psql`), and `migration:run` restores them; a throwaway column
      added to `Song` and booted did **not** get auto-added to Postgres,
      proving `synchronize` is actually off, not just set to `false` and
      trusted.
- [ ] Hot Module Reloading for faster dev loop
- [ ] Swagger/OpenAPI docs, including documenting auth flows

## Project 5: Add MongoDB Alongside SQL — Not started

## Project 6: Ship It — Not started

## Project 7 (Branch A): Real-Time Layer — Not started

## Project 8 (Branch B): GraphQL API — Not started

## Project 9 (Branch C): Rebuild Data Layer with Prisma — Not started

## Project 10: Capstone — Advanced Feature Grab Bag — Not started

---

## Known gaps / notes (not roadmap items, just worth remembering)

- `app.controller.spec.ts` has a pre-existing, unrelated failing test
  (expects the default Nest scaffold greeting `"Hello World!"`, but
  `AppController` now returns `"Hello I am learning nestjs!"`). Left alone —
  not part of the `songs` work this roadmap is tracking.
