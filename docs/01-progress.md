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

## Project 3: Authentication & Authorization — 🚧 In progress

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
- [ ] Role-Based Access Control
- [ ] Two-Factor Authentication
- [ ] API Key authentication

## Project 4: Production-Grade Setup — Not started

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
