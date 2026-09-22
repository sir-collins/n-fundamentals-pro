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
- [x] Debugging a NestJS app — `.vscode/launch.json` with an "Attach to
      Nest (start:debug)" config (`type: node`, `request: attach`, port
      `9229`, `restart: true` so it reattaches automatically when
      `start:debug`'s `--watch` restarts the process). No app code or
      dependencies changed — the inspector port was already available via
      the scaffold's existing `start:debug` script
      (`nest start --debug --watch`); this just wires VS Code to it.
      Verified: `npm run start:debug` boots normally and prints the
      `Debugger listening on ws://...:9229` line; attaching in VS Code shows
      "Debugger attached"; a breakpoint set inside
      `RolesGuard.canActivate` actually paused a real `PUT /songs` request
      made with a `user`-role token, with `request.user` and the resolved
      required roles inspectable live before resuming to the expected
      `403`; saving a watched file mid-session triggered a `--watch`
      restart with automatic reattach, no manual re-attach needed;
      `start:dev`/`start:prod` remained unaffected.
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
- [x] Hot Module Reloading for faster dev loop — new `start:hmr` script,
      `webpack-hmr.config.js` (standard Nest HMR webpack config:
      `webpack-node-externals` keeps `node_modules` external,
      `HotModuleReplacementPlugin` + `RunScriptWebpackPlugin` drive the
      update), and a `module.hot.accept()`/`dispose()` block added to
      `main.ts`. `start:dev`/`start:debug`/`start:prod`/`nest build` are
      untouched — this is a separate, additive dev-loop option.
      **Deliberately uses `nest build --webpack --watch`, not `nest start
      --webpack --watch`** as Nest's own docs show: read `@nestjs/cli`'s
      source directly and confirmed `StartAction` unconditionally spawns
      `dist/main.js` itself on every successful compile
      (`createOnSuccessHook`/`spawnChildProcess`), with zero awareness of a
      config-supplied `RunScriptWebpackPlugin` — so `nest start` runs the
      bundle *twice* (once via its own spawner, once via our plugin),
      losing the port race with a real `EADDRINUSE` crash every time.
      `BuildAction` never wires up that spawner, so `nest build --watch`
      leaves `RunScriptWebpackPlugin` as the sole runner — verified this
      concretely (two Nest PIDs raced port 3000 under `nest start`; exactly
      one PID, no crash, under `nest build`). Verified further: a comment
      edit round-tripped through `[HMR] Nothing hot updated.` (TS strips
      comments at compile time — no real code changed, so nothing to
      apply); a real code change (edited `AppService.getHello`'s return
      string) triggered a genuine incremental rebuild (`~380ms` vs. the
      cold build's `~3.5s`) and `curl localhost:3000/` served the new
      string immediately — all inside the **same OS process** (PID
      unchanged throughout, confirmed via `ps`), no fork/respawn. Being
      precise about what "hot" actually means here: `module.hot.dispose(()
      => app.close())` still tears down and fully rebuilds the whole Nest
      application context (DB pool included) on every change — the win is
      "no OS-level process fork + fast incremental compile," not "runtime
      state survives edits."
- [x] Swagger/OpenAPI docs, including documenting auth flows — pinned
      `@nestjs/swagger@^11.4.7` (its `latest`, `12.x`, requires
      `@nestjs/core@^12.0.0`; this project runs `^11.0.1` — same trap
      category as the `@nestjs/config` ESM-only major from step 1).
      `main.ts` mounts the UI at `/api` via `DocumentBuilder` +
      `SwaggerModule.setup`, registering **two independent, named security
      schemes** — `bearer` (JWT, matched by `@ApiBearerAuth()`) and
      `api-key` (the `x-api-key` header, matched by
      `@ApiSecurity('api-key')`) — so Swagger UI's "Authorize" modal shows
      a separate input per mechanism, and either can be tested
      independently. Every controller (`auth`, `songs`) got
      `@ApiTags`/`@ApiOperation`/`@ApiResponse` reusing the existing JSDoc
      prose; every DTO got `@ApiProperty`; `Song`/`Artist` entities got
      `@ApiProperty` so they work as real `@ApiResponse({ type: ... })`
      response types (`Artist.songs` deliberately left undocumented to
      avoid a circular schema back through `Song.artists`). Two real gaps
      in what Nest can infer, both worked around explicitly: `login()` has
      no `@Body() dto` (Passport's `LocalStrategy` reads the request
      directly) — added a doc-only `LoginDto` used solely for
      `@ApiBody({ type: LoginDto })`; `findAll`'s return type is
      `Paginated<Song>`, a plain interface Swagger can't introspect via
      `type:` — documented via a raw `schema:` with `getSchemaPath(Song)`,
      requiring `@ApiExtraModels(Song)` on the controller for the `$ref`
      to resolve. Auth's several ad-hoc trimmed response shapes (`Pick<User,
      ...>` etc.) were documented via literal `schema: { example: {...} }`
      rather than minting a dozen new response-only DTOs — a deliberate,
      proportionate choice for a first pass, not an oversight. Verified:
      fetched the generated `/api-json` spec directly and confirmed both
      security schemes are registered and land on exactly the right
      routes (`bearer` on every JWT-guarded route, `api-key` only on
      `whoami`, no security on public reads/signup/login/2fa-authenticate);
      confirmed `Song`'s schema resolves its nested `Artist` `$ref` and
      `GET /songs`'s paginated response shows the real `{ data: Song[],
      total }` shape, not a generic object; ran the actual auth flow live
      end-to-end (signup → login → bearer-protected `/auth/profile` →
      mint an API key → `whoami` via that key instead) and confirmed a
      non-admin still gets a real `403` on `POST /songs` — all exactly
      matching what the generated docs describe. `npx eslint .` and
      `npx jest` both clean.

## Project 5: Add MongoDB Alongside SQL — 🚧 In progress

- [x] Run MongoDB via Docker Compose — new `mongo` service in
      `docker-compose.yml` (official `mongo:7` image, own named volume),
      alongside the existing `postgres` service. No auth on the container
      itself — same local-dev-only pragmatism as postgres's own simple
      credentials.
- [x] Connect NestJS to MongoDB, define a Schema — `@nestjs/mongoose@^12.0.0`
      + `mongoose@^8` (checked peer compatibility against
      `@nestjs/core@^11.0.1` first, same version-check habit as every
      dependency added since Project 4 step 5 — no trap this time).
      `MongooseModule.forRootAsync(...)` added to `app.module.ts` beside
      the existing `TypeOrmModule.forRootAsync`, reading a new validated
      `MONGO_URI` env var. New `Comment` schema
      (`src/comments/schemas/comment.schema.ts`) via `@Schema()`/`@Prop()`
      decorator classes, mirroring how `@Entity()`/`@Column()` already
      work for Postgres.
- [x] Save, find, delete records; Populate references — **comments on
      songs, with threaded replies**, chosen deliberately over an
      activity-log alternative because it's the design that actually
      exercises a real Mongoose `ref`/`.populate()` (a self-referential
      `parentComment` field), not a faked cross-database join. New
      `CommentsModule`/`CommentsService`/`CommentsController`
      (`src/comments/`), mirroring `SongsModule`'s trio shape and
      `SongsService`/`SongsController`'s division of responsibility (no
      try/catch in the service; the controller owns all HTTP-status
      handling). Routes: `POST songs/:songId/comments` (any authenticated
      user — a deliberate difference from songs' admin-only mutations,
      since comments are user-generated content, not curated catalog
      data), `GET songs/:songId/comments` (public), `DELETE
      comments/:id` (author or admin only — a resource-*ownership*
      check, new logic, since `RolesGuard` only handles role checks, not
      ownership). `songId` is stored as a plain Postgres integer, not a
      Mongoose ref — there's no cross-database `populate()`, so its
      existence is validated at the service layer instead (via
      `SongsModule` now exporting `SongsService`). Verified end-to-end
      against the running app: posted a top-level comment as a non-admin
      user (`201`, real Mongo `_id`); posted a reply as a different user
      (admin) with `parentCommentId` set (`201`); `GET
      songs/:id/comments` came back with the reply's `parentComment`
      field as a **fully populated object** (the parent's real `body`/
      `authorEmail`), not a raw ObjectId string — confirming `.populate()`
      genuinely works; `POST`/`GET` against a nonexistent song both
      `404`; a non-author got a real `403` deleting someone else's
      comment, while the actual author's own delete succeeded and the
      comment was confirmed gone from a follow-up `GET`; an admin
      successfully deleted another user's comment (the ownership
      override). Known, accepted gap (same treatment as Project 2's
      orphaned `Artist` rows): deleting a parent comment leaves any
      reply's `parentComment` populate resolving to `null` — no cascade
      delete implemented. `npx eslint .` and `npx jest` both clean.

## Project 6: Ship It — 🚧 In progress

- [x] Separate dev/prod environments — mostly already done by Project 4
      step 1's config work (every value already read through
      `ConfigService` with Joi validation, never hardcoded); this step
      found and fixed the two actual gaps. `NODE_ENV` added to
      `env.validation.ts`'s schema (`development`/`production`/`test`,
      defaults `development`) — previously didn't exist anywhere in the
      codebase. `SwaggerModule.setup(...)` in `main.ts` was running
      unconditionally, exposing the full route list/auth shapes at
      `/api` regardless of environment; gated behind a **dedicated
      `ENABLE_SWAGGER`** boolean var (not tied to `NODE_ENV` — explicit
      and independently toggleable) defaulting to `true` so the
      existing dev workflow is unaffected. `start:prod` now actually
      sets `NODE_ENV=production` (was just `node dist/main` — nothing
      was setting it before). Already-confirmed-prod-safe, deliberately
      untouched: TypeORM's `synchronize: false` (unconditional,
      migrations-only) and `HttpExceptionFilter` (never leaks raw
      internal error details). CORS deliberately deferred to the
      Railway deploy step — not a dev-vs-prod distinction on its own.
      Verified against the real running app, not just reasoning about
      it: default boot still serves Swagger UI at `/api` (`200`);
      `ENABLE_SWAGGER=false` makes `/api` `404` while `/songs` and
      every other real route keep working normally; an invalid
      `NODE_ENV` value makes the app refuse to boot with a clear Joi
      validation error (confirmed via `curl` — connection refused,
      nothing bound to the port); `npm run start:prod` after a real
      `npm run build` was confirmed via `ps eww <pid>` to have
      `NODE_ENV=production` genuinely set in the running process's own
      environment, not just present in the script text. `npm test`,
      `npm run test:e2e`, and `npx eslint src/ test/` all still clean.
- [x] Push to GitHub, deploy to Railway — pushing to GitHub was already
      continuously true (every step in this project has gone through a
      PR); the new part was the actual Railway deploy. Signed up, linked
      the GitHub repo, provisioned Railway's own Postgres and MongoDB
      plugins, and wired the app's `DB_*`/`MONGO_URI` vars to them via
      Railway's `${{ServiceName.VAR}}` reference syntax (e.g. `DB_HOST=
      ${{Postgres.PGHOST}}`) — real values supplied by the platform, no
      `.env.production` file, matching the "separation is about values,
      not code paths" design from the previous step. Set a **fresh**
      `JWT_SECRET` for production (never the local dev one) and left
      `PORT` unset so the app follows whatever Railway injects (`8080`
      by default), which `main.ts` already reads via `configService.get
      <number>('PORT') ?? 3000`. Deployed live at
      `n-fundamentals-pro-production.up.railway.app`.
- [x] Fix env-related deployment bugs — a real one, not a contrived
      example. Railway's dashboard "Custom Start Command" field
      silently failed to take effect across **two separate attempts**
      (confirmed via deploy logs still showing plain `npm run start` →
      `nest start` both times, even after saving and manually
      redeploying) — so the app was booting under the dev-mode command,
      never running migrations, and Postgres's schema stayed empty
      (`GET /songs` returned a real `500`, not just an empty list,
      since the table didn't exist at all). Root-caused by actually
      reading the deploy logs rather than guessing twice, then fixed
      properly: committed a `railway.json` (`deploy.startCommand`),
      which Railway's own docs confirm takes priority over dashboard
      config — sidesteps whatever wasn't saving in the UI entirely, and
      keeps the setting version-controlled like every other piece of
      config in this project, rather than a manual dashboard click no
      one else can see. Verified against the live deployment, not just
      re-reading logs: `GET /songs` now returns the real empty-schema
      shape (`{"data":[],"total":0}`) instead of a `500`, confirming
      migrations genuinely ran; signed up a real user against
      production Postgres, logged in, and hit `GET /auth/profile` with
      the resulting JWT — a full round trip through the real database
      and the fresh production `JWT_SECRET`, not the local dev one.
- [ ] Testing with Jest: auto-mocking, spies, unit tests for
      controllers & services, E2E tests — **first sub-step done**: the
      E2E suite was actually broken (crashing before any test could
      run), fixed. Two separate real bugs, found by running
      `npm run test:e2e` rather than assuming it worked:
      1. `@nestjs/mongoose@^12.0.0` (added in Project 5) is pure ESM
         (its own `package.json` has `"type": "module"`) — Jest's
         default `transformIgnorePatterns` skips transforming anything
         under `node_modules`, so this one package reached Node's CJS
         `require()` untransformed and crashed with `SyntaxError:
         Unexpected token 'export'` before the app could even boot.
         Confirmed `mongoose` itself (the driver) is plain CommonJS —
         only the Nest wrapper package needed special handling.
         `test/jest-e2e.json` now widens `transformIgnorePatterns` to
         `node_modules/(?!(@nestjs/mongoose)/)` so `ts-jest` actually
         transforms it. Verified this was the real fix, not a
         coincidence: applying only this change turned the failure from
         a hard crash (0 tests ran) into the *next*, already-known
         issue below actually running and failing for its own reason —
         proof the ESM crash itself was gone.
      2. `test/app.e2e-spec.ts` still asserted the Nest-scaffold
         default, `'Hello World!'` — `AppService.getHello()` has
         returned `'Hello I am learning nestjs!'` since early in this
         project, already fixed once in the *unit* test
         (`app.controller.spec.ts`, 2026-09-07) but apparently never
         carried over to the e2e spec. Fixed to match.
      `npm run test:e2e` passes now; `npm test` and `npx eslint src/
      test/` both still clean. Remaining testing work (auto-mocking
      with real behavior tests, broader E2E coverage) is later
      sub-steps, not part of this one.

      **Second sub-step done**: `SongsService`/`SongsController`'s specs
      (previously pure Nest-CLI scaffold — `{}` stand-ins for every
      dependency, only `toBeDefined()` checks, nothing ever actually
      called) rewritten as genuine behavior tests, the flagship pattern
      for the rest of the app. `@golevelup/nestjs-testing`'s
      `createMock<T>()` replaces hand-written mocks (checked its
      peerDependencies first — zero runtime/peer deps declared, so no
      Nest-version compatibility risk at all, unlike most dependencies
      added in prior steps). `jest.spyOn(service, 'findOne')` gets a
      genuine use in `SongsService.update()`'s tests, which already
      calls `this.findOne(id)` internally — a real spy use case, not a
      contrived one. 21 new tests: `create`/`findAll`/`findOne` assert
      the exact repository call shapes; `update` covers not-found,
      merge-without-artists, and merge-with-artists-resolved; `remove`
      covers both `affected` outcomes; the controller spec covers every
      handler's success path plus its specific failure-to-status
      mapping (`null` → `404`, unexpected error → `500`,
      `NotFoundException` never accidentally caught by the generic
      wrap). Sanity-checked the tests themselves, not just the code:
      deliberately broke one assertion (expected the wrong title) and
      confirmed it actually failed, before reverting — proof these
      tests can catch a real regression, not just pass unconditionally.
      Found and fixed a real project-wide lint gap along the way:
      `@typescript-eslint/unbound-method` flags the standard
      `expect(mock.method).toHaveBeenCalledWith(...)` pattern (a
      well-known false positive for Jest mocks specifically) — added a
      `**/*.spec.ts`-scoped override in `eslint.config.mjs` disabling
      just that rule for spec files, rather than installing
      `eslint-plugin-jest` for one rule or silencing it project-wide
      (which would risk masking a real unbound-`this` bug in actual
      `src/` logic). Deliberately **not** in this step: guard unit
      tests (`RolesGuard` still has zero coverage — a good, separate,
      later candidate) and touching `app.controller.spec.ts` (already a
      correct minimal smoke test, not scaffold-and-forgotten). `npm
      test` now runs 22 tests across 3 suites (was 3); `npx eslint
      src/` and `npm run test:e2e` both still clean.

      **Third sub-step done**: `RolesGuard` (`src/auth/guards/roles.guard.ts`)
      now has real test coverage — new `roles.guard.spec.ts`, `0 → 6`
      tests. A guard needed a different test shape than a
      controller/service: `canActivate(context: ExecutionContext)` has
      no real `ExecutionContext` outside an actual HTTP request, so
      there's no `TestingModule` + direct-call pattern to reuse from
      the Songs step. Used a small hand-built fake exposing only the 3
      methods the guard actually touches (`getHandler`, `getClass`,
      `switchToHttp().getRequest()`), cast through `unknown` — chosen
      over `createMock<ExecutionContext>()` deliberately, since that
      interface has many methods this guard never calls, and a
      hand-built fake makes what's actually being simulated obvious to
      a reader. `createMock<Reflector>()` (same utility as the Songs
      step) controls what `@Roles(...)` metadata comes back. Covers all
      5 real branches (no metadata, empty-array metadata, missing
      `request.user`, wrong role, matching role) plus a collaboration
      assertion confirming `reflector.getAllAndOverride` is actually
      called with both the handler *and* the class — proving
      handler-level `@Roles()` can override a class-level one, not just
      that metadata gets read from somewhere. Same sanity check as the
      Songs step: deliberately broke one assertion, confirmed it
      failed, reverted. `npm test` now runs 28 tests across 4 suites;
      `npx eslint src/` and `npm run test:e2e` both still clean.

## Project 7 (Branch A): Real-Time Layer — Not started

## Project 8 (Branch B): GraphQL API — Not started

## Project 9 (Branch C): Rebuild Data Layer with Prisma — Not started

## Project 10: Capstone — Advanced Feature Grab Bag — Not started
