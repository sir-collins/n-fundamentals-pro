# Build journal

A chronological log of how this app actually got built: what we did, why we
did it that way, and what tripped us up along the way. `01-progress.md`
tracks *what's done*; this tracks *how we got there* — the reasoning and the
gotchas that don't show up in a diff.

## 2026-08-29 — Cleaning up the initial songs CRUD scaffold

The `songs` resource started as a `nest g resource`-style scaffold with a few
rough edges: `create()` manually re-checked fields the global `ValidationPipe`
already validated via `class-validator` decorators, and every handler
wrapped a guard clause in try/catch just to rethrow it — working, but more
ceremony than it needed. Simplified to one consistent shape per handler: a
guard clause throws the specific exception, the catch rethrows known
`HttpException`s as-is and converts anything else to a 500. Also caught that
`findOne` did the lookup and then threw the result away, returning a
hardcoded placeholder string instead of the song.

**Lesson:** when a framework already validates something globally (Nest's
`ValidationPipe`), duplicating that check locally isn't just redundant — it
tends to be *less* complete than the thing it's duplicating (the manual
check here missed two of the four fields).

## 2026-08-29 — Getting this onto GitHub

Installed the `gh` CLI via Homebrew (globally, so it's available for future
projects too), authenticated, created `sir-collins/n-fundamentals-pro`, and
pushed. First PR (#1) ended up a mix: the controller cleanup above, plus
changes made directly through VS Code's source control in parallel — a
`LoggerMiddleware`, and a real bug fix in `create-song-dto.ts`
(`artists` was validated with `@IsString()` instead of
`@IsString({ each: true })`, so array elements weren't actually being
checked). Merged clean, no conflicts.

**Lesson:** `gh repo create --source=. --remote=origin` plus `gh pr create`
is the whole GitHub setup loop from a terminal — no need to touch the
website at all.

## 2026-08-29 — Finishing Project 1 for real

Writing `01-progress.md` against what Project 1's checklist actually asks
for surfaced four items that were marked "done" but weren't: no dedicated
`SongsModule` (controller/service were registered straight on `AppModule`),
no Exception Filter, no `ParseIntPipe`, and `update`/`delete` didn't persist
anything (`SongsService` had no `update`/`remove` methods — the controller
only ever did an existence check).

Fixing `ParseIntPipe` forced a bigger realization: routes were matching
`:id` against a song's `title`, because songs had no real `id` field at all.
Added a proper `Song` entity with a server-assigned numeric `id`, which in
turn meant `create()` needed to return the created song (not the whole
array) so a client could actually learn the `id` it just got assigned.

Added `HttpExceptionFilter` (`@Catch(HttpException)`, registered globally in
`main.ts`) so every error response — ours and Nest's own, like a failed
`ParseIntPipe` — comes back in the same
`{ statusCode, timestamp, path, message }` shape.

**Lesson:** "add `ParseIntPipe`" sounds like a one-line change, but it's
really a data-modeling question in disguise — you can't validate an id as a
number if the thing you're looking up doesn't have one yet.

## 2026-08-29 — Commenting standards

Defined a small standard (`02-commenting-standards.md`): JSDoc on exported
classes and public methods, inline comments only for non-obvious "why" (not
"what"), no stale comments, file headers only when a file's role isn't
obvious. Applied it retroactively across every file in `src/`, as a
comments-only pass — verified via lint/typecheck/tests giving identical
results before and after, to be sure nothing behavioral slipped in.

**Lesson:** doing a "comments only" pass as its own commit (separate from
the feature work) makes it trivial to prove nothing else changed — the diff
review is just reading English.

## 2026-08-29 — Turning off the Co-Authored-By commit trailer

Set `attribution.commit: ""` in `.claude/settings.local.json` (already
gitignored globally on this machine, so it's a personal setting, not a
team-wide one).

## 2026-08-30 — Slowing down: step-by-step learning mode

Realized partway into planning Project 2 that building it all in one batch
defeats the point — the goal here is learning NestJS, not just having a
working app appear. Switched to: one small step at a time, explain the
concept and the *why* before writing code, pause for questions before
moving on. This journal, and the emphasis on `docs/` in general, exists
because of that shift.

## 2026-08-30 — Project 2, step 1: a real database

Project 2 swaps `SongsService`'s in-memory array for Postgres via TypeORM.
First step is just getting Postgres running locally, before any NestJS code
changes. Wrote `docker-compose.yml`: a `postgres:16-alpine` service with a
`nestjs`/`nestjs`/`n_fundamentals` user/password/database (fine to commit —
local dev only, not real secrets) and a named volume so data survives
`docker compose down`.

Hit a real gotcha immediately: Docker wasn't installed, and the automated
`brew install --cask docker` failed partway through because linking one of
its CLI helpers needs `sudo`, which can't prompt for a password from a
non-interactive background shell. Homebrew rolled the install back cleanly
on failure rather than leaving it half-installed. Docker Desktop needs a
manual, interactive install for this reason — noted here so future-us
doesn't try to automate it again and hit the same wall.

Once Docker Desktop was installed and running by hand, `docker compose up -d`
pulled the `postgres:16-alpine` image (~110MB, one-time cost) and started the
container without any further issues. Confirmed it was actually ready (not
just "started") with `docker exec n-fundamentals-postgres pg_isready -U
nestjs -d n_fundamentals` before calling the step done — a container can
report "Up" before Postgres inside it has actually finished initializing.

**Lesson:** `docker compose ps` showing `Up` isn't the same as the service
inside being ready to accept connections yet — `pg_isready` (or an
equivalent health check) is the real signal.

## 2026-08-30 — Project 2, step 2: wiring TypeORM into the app

Installed `@nestjs/typeorm`, `typeorm`, `pg` and added `TypeOrmModule.forRoot(...)`
to `AppModule`, pointed at the same host/port/credentials as
`docker-compose.yml`. `entities: []` for now — no `Song` `@Entity()` yet,
that's the next step. `synchronize: true` for dev convenience (auto-creates
tables from entities; unsafe in prod, migrations replace it in Project 4).

Deliberately hardcoded the connection config in code rather than reaching
for a `.env` file — the roadmap treats "custom configuration + validated
environment variables" as its own later item (Project 4), so introducing it
here would be solving a problem a step early.

Verified by booting the app on a scratch port (3001, so as not to fight the
already-running `start:dev` process on 3000) and confirming the log showed
`TypeOrmCoreModule dependencies initialized` with no connection errors,
before killing that one-off process.

**Lesson:** a NestJS module failing to connect to its database shows up as
a loud, unmissable error during `NestFactory.create()` — there's no way to
silently boot with a broken DB connection, which makes "did this actually
work" easy to check.

## 2026-08-30 — Project 2, step 3: Song becomes a real entity

`Song` got `@Entity()`, `@PrimaryGeneratedColumn()` on `id`, `@Column()` on
the rest. `artists: string[]` doesn't have a native Postgres scalar
equivalent, so it's `@Column('simple-array')` — TypeORM stores it as a
comma-separated string and converts it back to an array transparently.
`SongsService` swapped its in-memory array for an injected
`Repository<Song>` (`@InjectRepository(Song)`); every method is now a real
query (`save`, `find`, `findOneBy`, `delete`).

Said beforehand that `SongsController` "wouldn't need to change" since the
service's method signatures were staying the same — turned out wrong.
Repository calls are inherently async (they return `Promise`s), so every
controller handler needed `async`/`await` added, even though the *shape* of
each signature didn't change. Worth remembering: swapping sync in-memory
logic for a real I/O-backed implementation is never purely internal, even
when nothing about the public API "looks" different on paper.

Two things broke on the way, both fixed:
- **`songs.controller.spec.ts` / `songs.service.spec.ts`** — both
  instantiate `SongsService` directly in a `TestingModule` without a real
  database. Fixed by providing a stub via
  `{ provide: getRepositoryToken(Song), useValue: {} }` — enough for a
  "should be defined" smoke test, since neither spec calls a repository
  method yet.
- **`@nestjs/typeorm` version mismatch** — `npm install @nestjs/typeorm`
  grabbed the latest major (12.x) without checking it against the rest of
  the stack. v12 ships `"type": "module"` (ESM-only, no CommonJS build at
  all), while this whole project — NestJS 11, `ts-jest` — is CommonJS.
  `nest start` (webpack-based) tolerated it fine, but Jest's `require()`
  pipeline couldn't parse the ESM file at all: `SyntaxError: Unexpected
  token 'export'`. Downgraded to `@nestjs/typeorm@^11.0.3` (matches
  `@nestjs/core@^11.0.1`'s peer range, and has no `"type": "module"` field)
  and it went away entirely.

**Lesson:** `npm install <pkg>` with no version pin grabs latest, which can
silently be a major ahead of the rest of an existing stack. When something
that "should just work" throws an ESM/CJS error, check the new package's
`type` field and its peer dependency range against what's already
installed — don't assume the newest version is the compatible one.

## 2026-08-30 — Project 2, step 4: pagination

Added `PaginationQueryDto` (`page`/`limit`, both optional, `@Type(() =>
Number)` + `class-validator` bounds) and switched `GET /songs` to read it
via `@Query()`. `SongsService.findAll` now takes the DTO and calls
`repository.findAndCount({ skip, take })`, returning `{ data, total }`
instead of a bare array — `total` is what lets a client work out how many
pages exist.

This needed one more piece to actually work: query string values arrive as
strings (`"2"`), and `@Type(() => Number)` only does anything if the global
`ValidationPipe` has `transform: true` — it didn't, by default. Added it in
`main.ts`. Without this, `page`/`limit` would have stayed strings, and
`@Min(1)` etc. would have compared a string against a number and behaved
unpredictably instead of cleanly rejecting bad input.

Also hit a process-hygiene mistake, worth recording since it'll happen
again otherwise: killed a scratch test server with `kill $NEST_PID`, but
each Bash tool call in this session is its own shell — a variable set in
one call doesn't exist in the next, so that "kill" was silently a no-op on
an undefined variable, and the old server kept running in the background.
The next test run then hit the *stale* server on the same port (old code,
no pagination) instead of the new one, which had actually failed to start
with `EADDRINUSE` — and the stale server's responses looked plausible
enough (a plain array) that it could easily have been mistaken for a real
result. Caught it because invalid query params like `?page=abc` came back
`200` instead of `400`, which shouldn't have been possible. Fixed by
finding the real PID via `lsof -i :3001` and killing that directly, then
rerunning the test against a verified-fresh process.

**Lesson:** a background PID captured in one shell command is gone by the
next command — don't trust it to still be killable later in the same
session. And more generally: a suspiciously "too normal" result (an old
response shape, or a validation rule that silently didn't fire) is a
better signal to double-check *what actually served the request* than to
assume the new code is just slightly wrong.

Verified: seeded 3 songs, confirmed `page=1&limit=2` and `page=2&limit=2`
correctly split them 2-and-1 with a consistent `total: 3`, and that
`limit=0` / `page=abc` both come back `400` with clear per-field messages
via the existing exception filter.

## 2026-08-30 — Project 2 done: Song ↔ Artist, a real relationship

`Song.artists` went from a `simple-array` of names to a real many-to-many
relation: new `Artist` entity (`id`, unique `name`), `@ManyToMany()` +
`@JoinTable()` on `Song` (the owning side — TypeORM creates and manages the
`song_artists_artist` join table entirely on its own). Added `ArtistsService`
(`findOrCreateMany`) so the request body can keep sending plain artist name
strings — it resolves each name to an existing `Artist` row or creates one,
deduping the input first so two new-but-identical names in one request
don't both try to insert and collide on the unique constraint.

TypeORM relations aren't loaded by default (avoids surprise joins on every
query) — `findAll`/`findOne` needed `relations: { artists: true }` added
explicitly. Note the *object* shape, not `relations: ['artists']` — the
installed `typeorm` turned out to be `1.1.0` (`npm install typeorm` with no
pin grabbed a genuinely new major; `@nestjs/typeorm@^11.0.3`'s peer range
happened to allow it), and that version's `FindOptionsRelations` type only
accepts the object form. Caught immediately by `tsc`, not by discovering it
at runtime.

One small copy-paste-adjacent mistake worth naming: while adding the
`Artist` entities array entry to `TypeOrmModule.forRoot(...)` in
`app.module.ts`, one edit landed as a nonsensical ternary
(`import { Artist } from './songs/entities/song.entity' === undefined ? never : '...'`)
instead of a plain import statement — caught on the next read-through before
it was ever run, not by a tool. Worth remembering that multi-file edits done
quickly can produce garbage like this; reading the actual diff before moving
on is what catches it, not assuming an edit landed as intended.

Also had 15 rows of accumulated test data in `song` from earlier
`rest-client.http` runs (mostly duplicate "Blinding Lights" from re-running
the same request) sitting in the table when this step started — looked at
it directly before clearing it, since `synchronize: true` was about to drop
the old `artists` column, and dropping a column silently discards whatever
was in it.

Verified the relationship itself, not just that it compiled: created two
songs both crediting "The Weeknd" and confirmed — via a direct `psql` query
against the `artist` table, not just the API response — that only **one**
`Artist` row exists for that name, referenced by both songs' join rows.
Then updated one song's artists to drop "The Weeknd", and confirmed the
join row for that pairing was removed while the `Artist` row itself
survived (still referenced by the other song) — proving `update` replaces
a song's associations rather than merely adding to them, and that removing
an association doesn't delete the shared entity it pointed to.

This closes out Project 2's checklist. Next up: Project 3 (auth).

## 2026-08-30 — Project 3, step 1: user signup

New `User` entity (`id`, unique `email`, `password` holding a bcrypt hash)
and a `UsersModule`/`UsersService`, structurally the same shape as
`Artist`/`ArtistsModule`. New `AuthModule`/`AuthController` with
`POST /auth/signup`, the first endpoint that isn't `songs`.

The core idea worth being precise about: hashing isn't encryption.
Encryption is reversible (given the key); hashing isn't — you can never
get the password back from what's stored, only compare a new attempt's
hash against it. And a *fast* hash (SHA-256 etc.) isn't good enough for
passwords specifically, because fast means cheap to brute-force at scale.
bcrypt is deliberately slow (a tunable cost factor — used 10, a common
default) and salts automatically, so identical passwords don't produce
identical hashes.

`npm install bcrypt` triggered an "install scripts not yet covered by
allowScripts" warning — npm's newer script-allowlist security feature
blocking bcrypt's native-build postinstall script. Didn't just accept that
silently or fight it: tested `require('bcrypt').hash(...)` directly before
writing any app code, and it worked — bcrypt shipped a prebuilt binary for
this platform, so the blocked script was never actually needed. Worth the
extra minute to confirm rather than assume either "it's broken" or "it's
fine."

One design decision worth recording: `AuthService.signup` builds the safe
response by picking `{ id: user.id, email: user.email }` explicitly,
rather than destructuring `password` off the full entity and returning the
rest. A rest-omit pattern here would
silently start including any *new* field added to `User` later (a role
column, a phone number) in the public response unless someone remembered
to add it to the omit list too. Explicit field selection can't leak a
field nobody thought to exclude, by construction — the same "explicit over
magic" instinct as `SongsService`'s find-or-create logic.

Verified end to end: signed up, confirmed the response is exactly
`{ id, email }` (no hash), then read the row directly via `psql` and
confirmed the stored value really is a bcrypt hash, not the plaintext.
Signing up the same email twice correctly 409s; an invalid email format
and a too-short password both correctly 400 with clear per-field messages.

Verified end to end, not just "it compiles": booted the app, confirmed
`synchronize: true` created the `song` table (visible via
`docker exec ... psql -c '\dt'`); ran create/read/update/delete through the
real HTTP API; independently re-read the row with a direct `psql` query
(bypassing the app entirely) to confirm it was really in Postgres and not
some other cache; killed the running app process and restarted it, and the
previously-created song was still there. That last check is the actual
point of Project 2 — Project 1's in-memory array would have lost everything
on that restart.

## 2026-09-03 — Project 3, step 2: login + issuing a JWT

`POST /auth/login`, backed by Passport's local strategy. Passport works
via *strategies* — one per auth mechanism — and NestJS's `@nestjs/passport`
wraps that pattern. `LocalStrategy` (`src/auth/strategies/local.strategy.ts`,
a new `strategies/` subfolder anticipating a `jwt.strategy.ts` sibling
later) plugs into `AuthGuard('local')` on the route: the guard runs before
the controller handler's body ever executes, calling `LocalStrategy.validate`
(which calls `AuthService.validateUser`) and turning a thrown
`UnauthorizedException` into a `401` automatically. Worth being precise
about: `AuthService.validateUser` itself returns `null` on a bad
email/password, rather than throwing — that's the Passport convention;
*`LocalStrategy` is what decides* a `null` means "throw 401," keeping the
service method a plain predicate-ish lookup and the HTTP-shaped decision at
the strategy boundary. passport-local also defaults to a `username` field,
so the strategy's `super()` call needed an explicit
`{ usernameField: 'email' }` override to match this app's DTOs.

On success, `AuthService.login` signs a JWT via `@nestjs/jwt`'s
`JwtService`, payload `{ sub: user.id, email: user.email }`. Concept worth
being clear on: a JWT is a signed, self-contained credential — the server
verifies it later by re-checking the signature, no DB lookup or
server-side session state needed. That's a deliberate trade: it moves
"memory" from the server onto the client, at the cost that a leaked
signing secret lets an attacker forge a token for *any* user. This step
only *issues* tokens — no route requires one yet. That's next.

Pinned the new dependencies deliberately: `npm install @nestjs/jwt
@nestjs/passport` unpinned would have grabbed their latest majors (v12),
both ESM-only (`"type": "module"`) — the exact same trap `@nestjs/typeorm`
sprang back in Project 2, step 3, breaking `ts-jest`'s CJS `require()`
pipeline. Installed `@nestjs/jwt@^11.0.2` and `@nestjs/passport@^11.0.5`
instead (peer-compatible with this app's `@nestjs/core@11.x`), and checked
the installed `package.json`s afterward to confirm neither carries
`"type": "module"` before writing any code against them.

The JWT signing secret is a hardcoded placeholder in `AuthModule`
(`JwtModule.register({ secret: 'CHANGE_ME_DEV_ONLY_SECRET', ... })`) for
now, same "defer to Project 4's env-var config" call as the Postgres
credentials in `app.module.ts` — but flagged more seriously in the code
comment: this repo is public, and unlike a local dev DB password, a real
JWT secret genuinely must stay secret. It's a placeholder that must never
follow this app anywhere it isn't purely local.

`docker compose` had actually stopped since the last session (Docker
Desktop itself wasn't running) — the scratch app's first boot attempt
exhausted its Postgres connection retries and exited before I noticed;
had to `open -a Docker`, wait for the daemon, `docker compose up -d`, and
reboot the scratch server. Small reminder that "the DB was up last time"
isn't something to assume carries between sessions.

Verified end to end on scratch port 3001: logged in with the
already-existing `learner@example.com` user from the signup step, decoded
the returned JWT's payload and confirmed it's exactly
`{ sub, email, iat, exp }` — no password hash, nothing extra; a wrong
password and a never-signed-up email both 401 with `"Invalid credentials"`
(our own message, from `LocalStrategy`); a request missing the `password`
field entirely also 401s, but with Passport's own generic `"Unauthorized"`
message — that path never reaches `LocalStrategy.validate` at all, so it
was worth actually running rather than assuming it'd match the other two.

## 2026-09-03 — Project 3, step 3: protecting a route with the JWT

Login issues a token; this step is the other half — a route that actually
requires one. `JwtStrategy` (`src/auth/strategies/jwt.strategy.ts`) is a
direct sibling of `LocalStrategy`, same shape: Passport extracts and
verifies the token (`ExtractJwt.fromAuthHeaderAsBearerToken()`, signature +
expiry checked against the same secret used to sign it) *before*
`validate` ever runs, and `AuthGuard('jwt')` on a route means a
missing/malformed/expired token 401s without the controller body executing
at all — exactly the same guard-runs-first shape as `AuthGuard('local')`
on login.

Added the route deliberately as something new (`GET /auth/profile`,
returning `{ id, email }` from `req.user`) rather than retrofitting
`songs`. *Which* `songs` routes should require auth, and for whom, is
really what Role-Based Access Control (the next roadmap item) is about —
this step is just "does the guard mechanism work," kept separate from that
decision.

`JwtStrategy.validate` trusts the decoded payload directly as `req.user` —
no database lookup per request. Worth being honest about the trade-off
that comes with that, not just asserting the upside: a JWT's whole appeal
is *not* needing a DB round trip to authenticate a request, but that means
if a user were deleted or changed after a token was issued, the token
would keep working until it naturally expires (1 hour, per the
`signOptions` set in step 2). Accepted deliberately for now — the
alternative (re-fetching the user every request) throws away the reason
to use a JWT in the first place — but noted here rather than left as a
silent gap.

One small refactor alongside the new strategy: the JWT secret used to
exist only inside `JwtModule.register(...)` in `auth.module.ts`. Now that
`JwtStrategy` also needs it (to verify what `JwtModule` signs), it's
factored out into one exported `JWT_SECRET` constant both places import —
avoids the two ever silently drifting onto different literal strings,
which would otherwise fail in a confusing way (every token would verify as
invalid, with no obvious clue why).

`passport-jwt` checked against the registry before installing (same
discipline as `@nestjs/jwt`/`@nestjs/passport` last step) — `4.0.1`, no
`"type": "module"`, so no ESM trap this time.

Also: Docker's Postgres container had stopped again since the last
session — confirmed and restarted it *before* booting the scratch server
this time, rather than discovering it via a failed boot like last step.

Verified end to end on scratch port 3001: `/auth/profile` with no
`Authorization` header 401s; with a garbage token, also 401s; logged in
fresh for `learner@example.com`, and calling `/auth/profile` with that
token returned exactly `{ id: 3, email: "learner@example.com" }` — the
real authenticated identity, not just "some 200 response."

## 2026-09-03 — Project 3, step 4: Role-Based Access Control

The distinction worth being precise about: everything through step 3 was
*authentication* — "is this a real, logged-in user?" This step is
*authorization* — "is this logged-in user allowed to do **this**?" Two
different questions, and the status codes say so: a missing/invalid token
is still `401` (we don't know who you are), but a real, authenticated user
attempting something their role doesn't permit gets `403` (we know
exactly who you are; the answer is no). `RolesGuard` throws
`ForbiddenException` specifically to get that `403`, not `401`.

`User` gained a `role` column (`'user'` | `'admin'`, default `'user'`).
The one invariant that mattered most here: **signup can never hand out a
role**. Not "signup validates the role field" — signup's underlying
`UsersService.create(email, password)` has no role parameter *at all*, so
there's no code path where a client-supplied value could even reach the
database. Enforced by the type signature, not a runtime check that could
be forgotten or bypassed.

The mechanism is the standard Nest pattern: a `@Roles(...)` decorator that
just attaches metadata to a route (`SetMetadata`), and a separate
`RolesGuard` that reads that metadata back via `Reflector` and checks it
against `req.user.role`. A route with no `@Roles(...)` isn't touched by
the guard at all — opt-in per route, not a global default-deny. Since
`role` needs to be checked on every request with no DB round trip (same
"trust the token payload" design as `JwtStrategy` from last step), it now
travels inside the JWT too — `AuthService.login`'s payload gained `role`,
and `JwtStrategy.validate`'s returned `req.user` carries it. Small nice
side effect: `GET /auth/profile` (which just echoes `req.user`) now shows
the caller their own role for free.

**Gotcha worth flagging in the code, not just here:** guard order in
`@UseGuards(AuthGuard('jwt'), RolesGuard)` matters. `AuthGuard('jwt')`
must run first to populate `req.user` — reversed, `RolesGuard` would read
`req.user` before it exists.

Applied it to something real rather than a throwaway route: `songs`
mutations (`create`, `update`, `delete`) now require an authenticated
`admin`; `findAll`/`findOne` stay exactly as public as they've always
been. That contrast — same resource, different rules by both auth state
and role — is what made this worth verifying end to end rather than
trusting the types.

One accepted gap, named rather than glossed over: there's no self-service
way to *become* an admin. Verifying this step meant signing up a second
test user normally (still lands as `'user'`, confirming the invariant
above), then manually promoting it via a direct `psql UPDATE`. A real
admin-management flow is out of scope for this learning step — same shape
of deliberate gap as the orphaned `Artist` rows from Project 2.

Verified end to end on scratch port 3001: `synchronize: true` added the
`role` column (as a genuine Postgres enum type) cleanly, and the
pre-existing `learner@example.com` row picked up the `'user'` default
automatically, no manual backfill needed. `POST /songs` with no token
401s; with `learner@example.com`'s real (`'user'`-role) token, `403`s
with `"Insufficient role for this action"`; with the promoted admin's
fresh token, `create`/`update`/`delete` all succeed normally. `GET
/songs` and `GET /songs/:id` still need no token at all, unaffected.
`GET /auth/profile` with the admin token now includes `"role":"admin"`.

## 2026-09-03 — Project 3, step 5a: Two-Factor Authentication (enable + confirm)

TOTP (Time-based One-Time Password) is worth being precise about: the
server and the user's authenticator app both hold the same secret ahead of
time, and both *independently* compute a 6-digit code from that secret
plus the current time. The code is never transmitted between them in
advance — that's what actually makes it prove possession of the device,
not just knowledge of something. `otplib` handles generating the secret
and both sides of that computation; `qrcode` turns the secret into a
scannable image so nobody has to type a base32 string into their phone by
hand.

Split this the same way login/JWT-protection was split: this step is only
*enabling* 2FA (generate a secret, confirm it via a real code before
trusting it's set up correctly). Actually *enforcing* it — changing what
`POST /auth/login` returns once `isTwoFactorEnabled` is true — is a
deliberate, separate follow-up. Enabling without enforcing is a complete,
verifiable unit on its own: you can prove the whole generate → scan →
confirm loop works without touching the login flow at all.

Third instance of the same dependency lesson: `otplib`'s latest major
(`13.x`) is ESM-only, so pinned `otplib@12.0.1` (plain CJS, ships its own
`index.d.ts` — no separate `@types/otplib` needed; a same-named package at
`@types/otplib@10.0.0` exists on npm but is unrelated/stale, not used).
Same trap, third package, same fix: check the registry before installing
anything, not just anything popular.

A real bug the "boot it and hit it with curl" discipline caught that `tsc`
and `eslint` both missed entirely: `twoFactorSecret!: string | null` on
the entity threw `DataTypeNotSupportedError: Data type "Object" ... is not
supported by "postgres"` at actual boot time. TypeScript's reflection
metadata for a union type like `string | null` is just `Object` — fine for
TypeScript itself, useless for TypeORM trying to pick a Postgres column
type from it. Fixed with an explicit `@Column({ type: 'varchar',
nullable: true })`. Worth remembering: a nullable *string* column needs
its type spelled out; TypeORM only infers cleanly from non-union types.

Also fixed, a smaller ripple from adding new `User` columns at all:
`AuthService.validateUser`'s return type was `Omit<User, 'password'>`,
which — now that `User` has `twoFactorSecret`/`isTwoFactorEnabled` — meant
its actual return value (`{ id, email, role }`) stopped satisfying its own
declared type. Same fix as `signup` got during the RBAC step: switched to
an explicit `Pick<User, 'id' | 'email' | 'role'>` everywhere that value
flows (`validateUser`, `login`'s parameter, `LocalStrategy.validate`, the
login handler's `req.user` type) — states exactly what's actually used,
so it stops silently drifting every time `User` grows a column unrelated
to authentication.

Why a wrong code is `400`, not `401`/`403`: the caller already has a valid
JWT — their identity and role aren't in question. The failure is just
"this specific 6-digit code doesn't match," which is closer to a
validation failure (like the *other* `400`s in this codebase) than an
auth failure.

One gap named rather than glossed over: `twoFactorSecret` is stored in
Postgres as plain text, not encrypted at rest. Same "deferred, not hidden"
treatment as the hardcoded JWT secret — acceptable for a learning project,
not for a real production system.

Verified end to end on scratch port 3001: generated a secret for
`learner@example.com`, pulled the plaintext secret directly via `psql`
(since it's stored that way anyway), computed a real TOTP code from it
with `otplib` in a throwaway `node -e` — the same computation a real
authenticator app does — and confirmed the server accepted it:
`isTwoFactorEnabled` flipped to `true` in Postgres, matching the API
response. An obviously wrong code correctly `400`s. Both new routes still
`401` with no token at all, confirming the JWT guard is still in force.

## 2026-09-04 — Project 3, step 5b: enforcing 2FA at login

The interesting design question wasn't "check the code," it was: after
the password succeeds, how does the *next* request know whose account
it's checking a code against, without the client just being able to say
so? The wrong shortcut — accept a client-supplied user id alongside the
code — would let an attacker skip the password step entirely, just
guessing/enumerating ids and hammering codes against them. The actual
pattern: `login` issues a short-lived (`5m`) `tempToken`, a JWT whose only
job is proving "the password check for user N just succeeded, very
recently." `POST /auth/2fa/authenticate` takes that token plus a code,
verifies both, and only then mints a real `access_token`. The tempToken
itself is the credential the second step trusts — nothing client-supplied
is trusted blindly.

Real security gap this step had to close, not just design around: that
`tempToken` is still a validly-signed JWT, same secret as everything
else. `JwtStrategy` — the thing every `AuthGuard('jwt')`-protected route
goes through — had no concept of "kind of token." Before the fix, a
`tempToken` would have sailed straight through `AuthGuard('jwt')` and
worked as a real session on `/auth/profile`, the `admin`-only `songs`
routes, everywhere — completely defeating 2FA while looking, on the
surface, like it worked (login *did* refuse to hand out a real token
directly). Caught this while writing the plan, before any code — but
verification still treated it as unproven until actually demonstrated:
took a real `tempToken` and threw it at `GET /auth/profile` directly, and
only trusted the fix once that came back `401`. "I added a check" and "I
watched the exploit fail" are different claims; only the second one
counts as verified.

Mechanically this meant widening the `Pick<User, ...>` type that flows
`validateUser → login`/`LocalStrategy.validate`/the login handler's
`req.user` (same ripple shape as 3.5a, now `+ 'isTwoFactorEnabled'`) so
`login` has what it needs to decide which response shape to return.
`login`'s return type became a real discriminated union —
`{ access_token } | { twoFactorRequired: true; tempToken }` — which is a
breaking change to that endpoint's response contract for any account with
2FA on. That's not a bug to apologize for; it's what "enforce" has to
mean once you take it seriously.

One coincidence worth noting for future-me: `admin-candidate@example.com`
turned out to already have 2FA enabled by the time this step was
verified — not something this session did; presumably tested manually via
`rest-client.http` against the always-running dev server between
sessions. Good reminder the dev DB is shared, mutable state, not a fresh
fixture each time — the "2FA-off" regression check used a brand-new
signup instead of assuming any particular existing account's state.

Verified end to end on scratch port 3001: logging in as
`learner@example.com` (2FA on) returns `{ twoFactorRequired: true,
tempToken }`, not a token. Pulled the real secret via `psql`, computed a
real code with `otplib`, exchanged tempToken + code for a real
`access_token` at `/auth/2fa/authenticate`; decoded it — exactly
`{ sub, email, role, iat, exp }`, no `twoFactorPending`, and confirmed it
actually works on `GET /auth/profile`. A wrong code `400`s; a garbage
tempToken `401`s. The critical check: a *valid* tempToken thrown directly
at `/auth/profile` also `401`s — the bypass is closed, demonstrated, not
just asserted. A freshly signed-up (2FA-off) user still gets a direct
`access_token` from login, unaffected.

This completes the "Two-Factor Authentication" roadmap item. Also: this
is the first step landing via the new branch + PR workflow (decided
2026-09-04) instead of a direct push to `master`.

**Postscript, same day:** the plaintext-secret trade-off flagged as a
security gap in 3.5a turned out to matter practically almost immediately
— the authenticator app entry for a test account got deleted by accident
while manually testing this flow. Because the secret is recoverable
straight from Postgres (`SELECT "twoFactorSecret" FROM "user" WHERE
email = '...'`) and a fresh code computable from it with `otplib` in a
one-line `node -e`, there was no actual lockout — just re-derive the
current code and carry on. Worth being honest about both sides of this in
the same breath: the exact thing that makes local testing/recovery this
easy is the exact thing that would be a real problem if this secret were
ever encrypted-at-rest in a real deployment and *lost* the same way (no
recovery at all, by design — that's the point of encryption). Documented
the recovery recipe prominently in `rest-client.http` itself, right next
to where a code is needed, rather than leaving it implicit.

## 2026-09-04 — Project 3, step 3.6: API Key authentication (Project 3 complete)

Last item on Project 3's list, and a deliberately different shape of auth
from everything before it — signup, login, JWT sessions, and 2FA are all
*human* auth (a person typing a password, reading a phone). API keys are
for the case with no human present at all: a script, a cron job, another
service. A static credential sent on every request instead.

**Why SHA-256 for the key, not bcrypt, when every other secret in this app
uses bcrypt:** bcrypt's slowness exists to make brute-forcing a low-entropy
human password expensive. A random 32-byte key has nothing for that
slowness to meaningfully defend against — it's already unguessable. More
important, bcrypt actively can't do what this needs: every `bcrypt.hash()`
call embeds a fresh random salt, so the same input hashes to a different
output each time, which makes a direct `WHERE hashedKey = ?` lookup
impossible — you'd have to load every stored key and `bcrypt.compare()`
against each one just to authenticate a single request. SHA-256 is
deterministic, so the incoming key always hashes to the same value, and a
plain indexed lookup (the `unique: true` constraint on `hashedKey` is that
index) works. Different secret, different threat model, different tool —
not a downgrade from bcrypt, a different job.

**Why `ApiKeyGuard` is a plain `CanActivate`, not another Passport
strategy:** Passport's abstraction earns its keep for local/JWT auth
because both plug into a shared "extract a credential, verify it, hand
back an identity" pipeline with real complexity (parsing an
`Authorization` header, checking a signature and expiry). A header lookup
+ hash + DB row match doesn't need that machinery — writing it as a
direct Nest guard is simpler and, as a side effect, is a good look at the
*other* way Nest lets a route gate itself, not routed through Passport at
all. The guard still sets `request.user` to the exact same `{ id, email,
role }` shape `JwtStrategy.validate` produces, so nothing downstream
(`RolesGuard` included, though not exercised by this step) can tell which
mechanism actually authenticated the request.

**Why minting/listing/revoking a key requires a full JWT session, not
`ApiKeyGuard`:** if an API key could be used to mint more API keys, a
single leaked key would let an attacker mint unlimited replacements for
itself even after the original was revoked — key management has to sit
behind a stronger guarantee (a real login) than the thing it manages.

**Why revoking someone else's key id returns the same `404` as a
nonexistent one:** returning a `403` for "exists, but not yours" would
let a caller enumerate which key ids are in use by watching the status
code change. Treating both cases identically (`ApiKeysService.revoke`
checks existence and ownership together) costs nothing and closes that
off — same instinct as `AuthService.validateUser` returning `null` for
both "no such email" and "wrong password" rather than distinguishing them.

Verified end to end on scratch port 3001: minted a key for a fresh user,
confirmed via direct `psql` that only a 64-character SHA-256 hex digest is
stored — computed the hash of the raw returned key independently and
confirmed it matched exactly. `GET /auth/api-keys/whoami` with just the
`x-api-key` header (no `Authorization` header at all) returned `{ id,
email, role }` identical to that same user's `GET /auth/profile` response
— same identity, proven two different ways. A garbage key and a missing
header both `401`, with distinct messages. `lastUsedAt` was `null`
immediately after minting and became a real timestamp after the `whoami`
call, proving the guard's DB update path actually ran, not just the
lookup. Revoked the key, then — the critical check — hit `whoami` again
with the *exact same* raw key: `401`, proving revocation actually removes
access rather than just deleting the list entry. Signed up a second user
and had them attempt to revoke the first user's key: `404`, and the key
was confirmed still live for its real owner afterward, proving the delete
never happened rather than just trusting the status code.

This completes Project 3 — signup, login, JWT sessions, RBAC, 2FA
enforced at login, and now API keys, all verified end to end rather than
assumed to work from reading the code. Project 4 (production-grade setup:
environment config, replacing the hardcoded JWT secret and Postgres
credentials, migrations instead of `synchronize: true`) is next.

## 2026-09-06 — Project 4, step 1: custom configuration + validated env vars

First Project 4 step: replacing the two hardcoded secrets that Project 3
kept flagging and deferring — `JWT_SECRET` in `auth.module.ts`, and the
full Postgres connection block in `app.module.ts` — with `@nestjs/config`
+ a Joi validation schema.

**The point wasn't just "move the strings to a `.env` file."** A `.env`
file that's silently allowed to be incomplete is barely better than a
hardcoded literal — you just trade "wrong value, visible in the diff" for
"missing value, `undefined` at runtime, failing confusingly three layers
away from the actual cause." `ConfigModule.forRoot({ validationSchema })`
means a missing or malformed required variable fails **at boot**, loudly,
with a message that names the exact variable — closer to a compile error
than a runtime surprise. Verified this is real, not just configured:
commented out `JWT_SECRET` in `.env`, rebooted, and got exactly `Config
validation error: "JWT_SECRET" is required` before the app ever finished
`NestFactory.create` — confirmed via `curl` that nothing was actually
listening on the port (connection refused), not just an error printed to
a log while the server kept running anyway. Restored `.env`, rebooted,
normal operation resumed.

**Another instance of this project's recurring dependency-pin lesson:**
checked the registry before installing (now reflexive after otplib,
`@nestjs/jwt`, `@nestjs/passport`, and `@nestjs/typeorm` all turned out to
have ESM-only latest majors) — `@nestjs/config`'s latest, `12.x`, is
`"type": "module"`, same trap. Its last CommonJS major is `4.x`
(`4.0.4`), still compatible with this project's Nest v11 core. Pinned
that instead of latest, then immediately ran `tsc`/`jest` right after
`npm install` and before writing any new code, specifically to catch a
breakage at the cheapest possible point if the pin were wrong.

**`JWT_SECRET` got a real value, not a renamed placeholder.** The old
hardcoded `'CHANGE_ME_DEV_ONLY_SECRET'` string could have just been
copy-pasted into `.env` unchanged — technically "moved to an env var,"
but still a well-known, guessable value. Generated a fresh random 32-byte
hex string with `crypto.randomBytes` instead, so the local `.env` holds
something that's actually a secret. Every token issued before this change
stopped verifying the moment the secret changed — expected, not a
regression (session tokens are short-lived and dev-only; nothing to
migrate).

**Where each value now comes from:** `app.module.ts`'s
`TypeOrmModule.forRoot` and `auth.module.ts`'s `JwtModule.register` both
moved to their `*Async` counterparts (`forRootAsync`/`registerAsync`),
injecting `ConfigService` to read connection details and `JWT_SECRET`
respectively — both needed to happen at module-construction time, after
`ConfigModule` (registered `isGlobal: true`, so no per-module re-import
needed) has validated and loaded everything. `JwtStrategy` — previously
importing a shared `JWT_SECRET` constant exported from `auth.module.ts`
— now injects `ConfigService` directly and reads the same key itself.
Signing and verifying still can't silently drift onto different values
(same guarantee the old shared-constant approach gave), just sourced from
validated config instead of a shared literal.

**One existing behavior worth confirming didn't break:** this project's
whole scratch-port testing pattern depends on `PORT=3001 npm run
start:dev` overriding the default port. `@nestjs/config`'s underlying
`dotenv` load doesn't override a variable already present in the shell
environment by default — confirmed this holds: with `.env`'s `PORT=3000`
in place, `PORT=3001` on the command line still won and the scratch
server came up on 3001, not 3000.

Regression-checked (not just "it compiles," since the actual logic in
every handler is unchanged — only *where* secrets come from):
signup → login → a fresh JWT working on `GET /auth/profile`, and minting
+ using an API key against `GET /auth/api-keys/whoami` — both prove the
Postgres connection and JWT signing/verification are genuinely live
through the new config path.

Explicitly deferred, as already discussed: hardening `docker-compose.yml`
itself (its hardcoded Postgres credentials are a separate concern from
what the *app* hardcodes), and making the JWT `expiresIn` policy
configurable (a policy choice, not a secret).

## 2026-09-07 — Project 4, step 2: migrations + seeding

Second Project 4 step: turning off `synchronize: true`, which had been
flagged as a known risk since Project 2 ("can silently drop/alter
columns... Migrations replace this once schema changes need to be
reviewable").

**The CLI doesn't share the app's DI container.** `TypeOrmModule.forRootAsync`
in `app.module.ts` reads connection details from `ConfigService`, but
TypeORM's own CLI (`typeorm-ts-node-commonjs`) runs as a standalone
script — it can't inject anything from Nest. It needs its own plain
`DataSource`, so `src/database/data-source.ts` loads `.env` directly via
`dotenv/config` instead. Hit one real error here: giving that file both
a named export and a `export default` of the same `DataSource` instance
made the CLI refuse to load it ("must contain only one export of
DataSource instance") — it counts each export binding, not each distinct
object. Fixed by keeping exactly one export.

**The gotcha that mattered most: you can't generate a real migration from
a `synchronize`-built database.** `migration:generate` works by diffing
entities against the live schema — if `synchronize: true` already made
the DB match, the diff is empty. There's nothing wrong with the tool;
it's correctly reporting "nothing needs to change" against a database
that's already caught up. Worked around it by actually resetting local
Postgres to nothing (`docker compose down -v && up -d` — a real, if
low-stakes, data loss, already flagged to and accepted by the user before
doing it) and generating the *first* migration against a genuinely empty
database. Verified the result matters more than trusting the process:
captured `\d` output for every table before the reset, generated +ran the
migration, captured `\d` again, and diffed the two — identical, down to
the same auto-generated constraint names Postgres/TypeORM had picked
before. The only new thing was TypeORM's own `migrations` bookkeeping
table, which is supposed to be there.

**Two more things proven, not just configured:**
- `migration:revert` actually reverses the migration, not just prints a
  success message: ran it once, confirmed via `psql` that every table it
  had created was genuinely gone (`\dt` showed only the bookkeeping
  table), then `migration:run` again to restore.
- `synchronize` is actually off, not just set to `false` and trusted:
  added a throwaway nullable column to `Song`, let the app boot normally
  against the mismatched schema (it doesn't care — TypeORM only maps
  columns it's told to query), and confirmed via `psql` the column never
  appeared in Postgres. Reverted the entity change immediately —
  never committed.

**Seeding respected a security boundary already established in Project
3, rather than punching a hole in it for convenience.** `UsersService.create`
deliberately has no `role` parameter — its own doc comment says "nothing
here can hand out `'admin'` from client input," and that's true regardless
of whether the caller is an HTTP request or a local script. Adding a
`role` argument to `create()` just to make seeding an admin account
easier would have quietly widened that method's contract for every other
caller too. Instead, `src/database/seed.ts` calls `usersService.create()`
for the hashing/dedup logic (still real business logic, not a raw SQL
insert), then promotes the account via a direct
`Repository<User>.update()` — the exact same out-of-band pattern
`rest-client.http` already documents for real admin promotion. The
security boundary isn't "no code path can ever set `role: 'admin'`," it's
"no code path *reachable from client input* can" — a local dev script run
by whoever already has full DB access was never inside that boundary.

Seeding itself boots the full Nest DI container with no HTTP listener
(`NestFactory.createApplicationContext`), so `UsersService`/`SongsService`
run exactly as they do in the real app — password hashing, duplicate-email
checks, artist name resolution, all still enforced. Made it idempotent
for users (catch `ConflictException`, log "already exists, skipping"
instead of crashing) since a learner re-running `npm run seed` on a
half-seeded or already-seeded DB is a realistic, non-error case; left
song re-seeding as a known, accepted gap (no uniqueness constraint on
title, so re-running would duplicate the sample song) rather than adding
dedup logic to `SongsService` just for a seed script's benefit.

This completes the second Project 4 item. Remaining: debugging tooling,
hot module reloading, and Swagger/OpenAPI docs.

## 2026-09-07 — Fixing the stale `app.controller.spec.ts` failure

Small, unrelated housekeeping item, deliberately its own commit rather
than folded into a roadmap step: `AppController.getHello()` has returned
`'Hello I am learning nestjs!'` since very early in this project (a
deliberate customization, not a bug), but `app.controller.spec.ts` still
asserted the original Nest-scaffold default, `'Hello World!'` — the test
was just never updated when the greeting changed. Updated the assertion
to match the real, intended behavior. `npx jest` now passes all 3 suites
clean for the first time this project has had zero failing tests.

## 2026-09-10 — Debugging a NestJS app (backfilled)

Every verification up to this point had been black-box: curl/`rest-client.http`
plus a `psql` read, never an actual paused breakpoint. This step is pure
tooling — `.vscode/launch.json` with a single **attach** config (`type:
node`, `request: attach`, port `9229`, `restart: true`), wired to the
scaffold's existing `start:debug` script (`nest start --debug --watch`,
already present, just never used). Attach over launch was a deliberate
choice: it keeps the existing terminal-based workflow (run `npm run
start:debug` yourself, watch its own logs) instead of moving output into
VS Code's debug console.

`restart: true` matters specifically because `start:debug` also passes
`--watch` — without it, a file-save-triggered restart would silently
leave the debugger detached until manually reattached. Verified for
real, not just "the config looks right": set a breakpoint inside
`RolesGuard.canActivate`, fired a real `PUT /songs/:id` with a
`user`-role (non-admin) token from `rest-client.http`, and confirmed
execution actually paused — inspected `request.user` and the resolved
required-roles metadata live in VS Code's Variables pane before
resuming to the expected `403`. Also confirmed a `--watch`-triggered
restart mid-session reattached automatically with no manual step, and
that `start:dev`/`start:prod` remained completely unaffected — this
step touches no application code, only editor tooling.

## 2026-09-10 — Hot Module Reloading (backfilled)

The goal: swap the dev loop's full OS-level process restart (what
`start:dev`'s `nest start --watch` already does on every save) for
webpack's actual Hot Module Replacement — recompile only the changed
modules and update the *same* running process, no process fork. Added
`webpack-hmr.config.js` (Nest's standard HMR recipe:
`webpack-node-externals` keeps `node_modules` external,
`HotModuleReplacementPlugin` + `RunScriptWebpackPlugin` drive the
update) and a `module.hot.accept()`/`dispose()` block in `main.ts`,
behind a **new** `start:hmr` script — deliberately not replacing
`start:dev`, so the existing tsc-based loop and `start:prod`/`nest
build` stay untouched while the two approaches could be compared.

Hit a real bug the textbook recipe doesn't warn about: the "obvious"
script, `nest start --webpack --webpackPath webpack-hmr.config.js
--watch`, crashed with `EADDRINUSE` on *every* boot. Rather than guess,
read `@nestjs/cli`'s own source
(`actions/start.action.js`/`compiler/webpack-compiler.js`) directly and
found the actual cause: `StartAction` unconditionally spawns
`dist/main.js` itself on every successful compile
(`createOnSuccessHook`/`spawnChildProcess`), with zero awareness that
the webpack config might already have its own `RunScriptWebpackPlugin`
doing the same thing — so `nest start` always runs the bundle *twice*,
and the second process loses the port race. `BuildAction` never wires
up that spawner at all, so switching to `nest build --webpack
--webpackPath webpack-hmr.config.js --watch` leaves
`RunScriptWebpackPlugin` as the sole runner. Confirmed concretely, not
just by reasoning about the source: two distinct PIDs racing port 3000
under `nest start`; exactly one PID, no crash, under `nest build`.

Verified end-to-end what "hot" actually buys here, and what it doesn't:
a real code change (edited `AppService.getHello`'s return string)
triggered a ~380ms incremental rebuild (vs. the ~3.5s cold build) and
`curl localhost:3000/` served the new string immediately — all inside
the *same* OS process, confirmed via `ps` showing an unchanged PID
throughout. But `module.hot.dispose(() => app.close())` still tears
down and fully rebuilds the whole Nest application context (TypeORM
pool included) on every change — so the actual win is "no process fork
+ fast incremental compile," not "runtime state survives edits," and
it's worth being precise about that rather than overselling it.

Also fixed two real ESLint errors the "official" HMR recipe's own code
doesn't satisfy in a project with `typescript-eslint`'s
`recommendedTypeChecked` config: `declare const module: any` trips
`no-unsafe-member-access`/`no-unsafe-call` on every `module.hot.*`
access (fixed by typing `module` narrowly instead of `any`), and
`dispose(() => app.close())` trips `no-misused-promises` (a `Promise`
returned where `void` was expected — fixed with `() => void
app.close()`). Separately, `webpack-hmr.config.js` itself — a root-level
CommonJS config file, not part of the `tsconfig`-covered app code —
needed the exact same treatment already given to `eslint.config.mjs`:
added to that file's own `ignores` array, since ESLint's type-aware
parser can't type-check a file the TS project doesn't include.

This completes the fourth Project 4 item. Remaining: Swagger/OpenAPI docs.

## 2026-09-11 — Swagger/OpenAPI docs, including documenting auth flows

The last Project 4 item, and the one the roadmap singles out a sub-goal
for by name: "documenting auth flows." This app has genuinely two
independent auth mechanisms (JWT bearer, `x-api-key`) plus a two-step
2FA login (`login` → `tempToken` → `2fa/authenticate` → real token) —
exactly the kind of thing OpenAPI's multiple named security schemes
exist for. `main.ts` registers both via `DocumentBuilder`:
`.addBearerAuth()` (default scheme name `'bearer'`, matched by
`@ApiBearerAuth()` used with no arguments) and `.addApiKey({ type:
'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')` (matched by
`@ApiSecurity('api-key')`), so Swagger UI's "Authorize" modal shows a
separate input per mechanism and either can be tested on its own.

Found the same category of version trap as `@nestjs/config`'s
ESM-only major back in step 1, before it could bite: `@nestjs/swagger`'s
`latest` (`12.0.1`) requires `@nestjs/core@^12.0.0`, but this project
runs `^11.0.1` — confirmed via `npm view @nestjs/swagger@11
peerDependencies` that the last `11.x` release requires exactly
`@nestjs/core: ^11.0.1`, and pinned `@nestjs/swagger@^11.4.7` instead of
trusting a bare `npm install`.

Two real gaps in what Nest/Swagger can infer automatically, both
resolved deliberately rather than left generic: `login()` has no
`@Body() dto` param at all — Passport's `LocalStrategy` reads
`email`/`password` off the request directly — so there was nothing for
Swagger to infer a request body from. Added a small doc-only `LoginDto`
(never used for actual validation, which still happens in
`LocalStrategy`) purely for `@ApiBody({ type: LoginDto })`, matching
every other route's pattern rather than reaching for an inline
`@ApiBody({ schema: {...} })`. Separately, `findAll`'s return type is
`Paginated<Song>` — a plain interface in `songs.service.ts`, not a
class — which Swagger's `type:` option can't introspect. Documented it
with a raw `schema:` referencing `getSchemaPath(Song)`, which required
adding `@ApiExtraModels(Song)` at the controller level so the `$ref`
actually resolves instead of pointing at nothing.

Scoped the response-documentation effort deliberately rather than
maximally: `Song`/`Artist` entities got `@ApiProperty` on their fields
so `@ApiResponse({ type: Song })` shows a real shape (and
`Artist.songs`, the relation's inverse side, was deliberately left
undocumented — `Song` already carries `artists`, and documenting both
directions would create a circular schema reference for no benefit).
But auth's several routes return ad-hoc trimmed shapes (`Pick<User,
'id'|'email'>`, etc.) rather than a full entity — minting a
response-only DTO class for each would have added roughly a dozen new
files for a first documentation pass. Used `@ApiResponse({ status,
description, schema: { example: {...} } })` with a literal example
object instead — a proportionate choice for now, not an oversight, and
one that can be upgraded to real response DTOs later if the docs need
to get stricter.

Verified by reading the actual generated spec, not just trusting the
decorators compiled: fetched `/api-json` directly and confirmed both
security schemes land on exactly the intended routes (`bearer` on every
JWT-guarded route, `api-key` only on `whoami`, no security requirement
on the genuinely public routes — reads, signup, login, and
`2fa/authenticate` itself, which can't require a token since the caller
doesn't have one yet); confirmed `Song`'s schema resolves its nested
`Artist` `$ref` and that `GET /songs` shows the real `{ data: Song[],
total }` shape instead of a generic object. Then ran the real flow
end-to-end against the running app — signup, login, `GET /auth/profile`
with the bearer token, minted an API key, `whoami` with that key
instead, and confirmed a non-admin token still gets a real `403` on
`POST /songs` — all exactly matching what the generated docs describe,
not merely what they claim. `npx eslint .` clean, `npx jest` all 3
suites passing.

This completes Project 4. Next: Project 5, adding MongoDB alongside the
existing Postgres/TypeORM data layer.

## 2026-09-11 — Comments on songs (Project 5, MongoDB alongside Postgres)

The roadmap's own suggestion for this step was "activity logs or
comments." Picked comments deliberately, not by default: an activity log
doesn't naturally need a second document to reference, while threaded
replies on a comment do — and "populate references" is a named roadmap
goal, not an optional extra. So the design is comments *with* threaded
replies specifically so there'd be a real Mongoose `ref`/`.populate()` to
exercise, not just CRUD against a single flat collection.

That shaped a distinction worth being precise about: a `Comment`'s
`songId` (the Postgres song it belongs to) is a **plain stored number**,
not a Mongoose ref — there's no such thing as a cross-database
`populate()`, so a `songId`'s existence is checked explicitly in
`CommentsService`/`CommentsController` via the (now-exported)
`SongsService`, the same way any other business rule gets checked. The
`parentComment` field, by contrast, points to another document in the
*same* Mongo collection, so it's a genuine `ref: 'Comment'` that
`.populate()` actually resolves. Two fields that look similar
(both "a reference to something else") but work completely differently
under the hood, and the code says so rather than treating them the same.

Followed the same version-compatibility habit established since
`@nestjs/config`'s ESM-only trap: checked `@nestjs/mongoose`'s
peerDependencies against the installed `@nestjs/core@^11.0.1` *before*
installing, this time via `npm view`. No trap this time —
`@nestjs/mongoose@^12.0.0` explicitly accepts `^11.0.0 || ^12.0.0`, so it
installed clean alongside `mongoose@^8`.

Kept `CommentsService`/`CommentsController`'s division of responsibility
identical to `SongsService`/`SongsController` rather than inventing a
second style for the new database: the service has no try/catch at all
(plain async methods, `null` for "not found"), and the controller owns
every `HttpException`. The one genuinely new piece of authorization
logic is in `DELETE comments/:id` — checking `comment.authorId ===
req.user.id || req.user.role === UserRole.ADMIN` directly in the
controller, since this is a resource-*ownership* check, not a role
check; `RolesGuard` already exists but solves a different problem (does
this role have blanket permission for this route at all), not this one
(does this specific caller own this specific resource). Comments
themselves are also postable by any authenticated user, not just admins
— a deliberate contrast with songs' admin-only mutations, since a
comment is user-generated content, not curated catalog data.

Verified for real against the running app, not just that it compiled:
posted a top-level comment as one user, a reply as a *different* user
(the seeded admin) with `parentCommentId` set, then fetched the song's
comments and confirmed the reply's `parentComment` came back as a fully
resolved object — the parent's actual `body` and `authorEmail`, not a
raw ObjectId string — proving `.populate()` genuinely works end to end.
Also confirmed the negative paths: `POST`/`GET` against a nonexistent
song both `404`; a non-author deleting someone else's comment got a real
`403`; the actual author's own delete succeeded, confirmed gone from a
follow-up `GET`; an admin could delete another user's comment (the
ownership override). Noticed and deliberately left as a known gap,
rather than silently working around it: deleting a parent comment leaves
a reply's `parentComment` populate resolving to `null` afterward — no
cascade delete implemented, the same category of accepted gap as
Project 2's orphaned `Artist` rows. `npx eslint .` clean, `npx jest` all
3 suites passing (untouched by this step — no existing behavior
changed, only additive).

## 2026-09-14 — Fixing the broken E2E suite (Project 6, step 1)

Deliberately started Project 6 here rather than with unit tests: running
`npm run test:e2e` (rather than assuming it worked, since nothing had
touched it since Project 1) turned up a hard crash —
`SyntaxError: Unexpected token 'export'` inside
`@nestjs/mongoose/dist/index.js`, before a single test could even run.

Root cause, confirmed by inspection rather than guessed:
`@nestjs/mongoose@^12.0.0` (added in the Project 5 step) is genuinely
**pure ESM** — its own `package.json` has `"type": "module"`, and its
entry point is literally `export * from './common/index.js'`. Jest's
e2e config (`test/jest-e2e.json`) transforms `.ts`/`.js` through
`ts-jest`, but Jest's *default* `transformIgnorePatterns` skips
transforming anything under `node_modules` — so this one ESM-only
package reached Node's CommonJS `require()` completely untransformed.
Checked `mongoose` itself (the actual driver, as opposed to the Nest
wrapper) before assuming the whole dependency tree needed the same
treatment — it's plain CommonJS (`"type": "commonjs"`), so only
`@nestjs/mongoose` needed special handling. This never surfaced in
`npm test` (plain unit tests) because those specs mock every dependency
directly and never import `AppModule`/`MongooseModule` at all — only
`test:e2e` boots the real app.

Fix: widened `transformIgnorePatterns` to
`node_modules/(?!(@nestjs/mongoose)/)` so `ts-jest` actually processes
that one package instead of skipping it. Verified this was genuinely
the fix, not a coincidence, by watching the failure mode *change*: with
only this change applied, the suite went from a hard crash (0 tests run
at all) to the app booting successfully and a single, different,
already-known assertion failure — proof the ESM crash specifically was
gone, not just that something else shifted around it.

That second failure was real too, and had been sitting there
undetected: `test/app.e2e-spec.ts` still asserted the Nest-scaffold
default, `'Hello World!'`, even though `AppService.getHello()` has
returned `'Hello I am learning nestjs!'` since early in this project —
and even though the exact same staleness was already found and fixed
once before, in the *unit* test (`app.controller.spec.ts`, see the
2026-09-07 entry above). It just never got carried over to the e2e
spec, because nothing had actually run that spec since. Fixed to match.

One more thing surfaced, and the first theory about it was wrong —
worth recording honestly rather than quietly correcting it. The IDE
flagged `describe`/`it`/`beforeEach` as unresolvable in
`test/app.e2e-spec.ts`. `npx tsc --noEmit -p tsconfig.json` (the
identical project config, whole repo including `test/`) came back
clean, which looked like proof it was just a stale VS Code TS-server
cache — restart and move on. Restarting the TS server didn't clear it,
which meant that theory was simply wrong, not "needs more patience."
The actual difference: every other spec file in this repo
(`songs.service.spec.ts`, `songs.controller.spec.ts`) explicitly
imports Jest's globals from `@jest/globals` instead of relying on
ambient `@types/jest` globals — `app.e2e-spec.ts` was the one file that
didn't. VS Code's language server evidently resolves ambient globals
for `test/` differently than a plain CLI `tsc -p tsconfig.json` run
does (never fully root-caused *why* — not worth the time once the fix
itself was obvious and consistent with this repo's own convention).
Added the same explicit `@jest/globals` import here, confirmed the
diagnostic actually cleared (not just "should be fine now"), and
confirmed `test:e2e` still passes.

`npm run test:e2e` passes now; `npm test` and `npx eslint src/ test/`
both still clean. Remaining Project 6 testing work — real auto-mocked
unit tests with actual behavior assertions (current specs are pure
Nest-CLI scaffold: `{}` stand-ins for every dependency, only
`toBeDefined()` checks, nothing ever actually called), and broader E2E
coverage beyond the one `GET /` check — is scoped as later, separate
sub-steps, along with dev/prod environment separation and the actual
Railway deploy.

## 2026-09-15 — Real unit tests for Songs, with auto-mocking and spies

Second Project 6 testing sub-step, deliberately scoped to just
`SongsService`/`SongsController` as the flagship pattern rather than
attempting the whole app at once — auth alone has roughly six services,
and doing all of them in one pass would be a much bigger, harder-to-
review change than the pattern itself deserves.

"Auto-mocking" is `@golevelup/nestjs-testing`'s `createMock<T>()` —
every method on a mocked dependency becomes a real `jest.fn()`
automatically, instead of hand-writing `{ findOne: jest.fn(), save:
jest.fn(), ... }` for every provider by hand. Checked its
`peerDependencies` before installing, same habit as every dependency
since the `@nestjs/config` ESM-major trap — this one declares **zero**
runtime dependencies and **zero** peer dependencies at all, so there
was genuinely nothing to check for compatibility; it's a pure,
Nest-version-agnostic utility.

"Spies" got a real use, not a contrived one: `SongsService.update()`
already calls `this.findOne(id)` internally before deciding whether to
save. `jest.spyOn(service, 'findOne')` lets a test control that
internal call's return value directly (hit the not-found branch, or
hand back a specific existing song) without re-mocking the whole
`Repository<Song>` just to get there indirectly.

Sanity-checked the tests themselves before trusting them: temporarily
changed one assertion to expect the wrong value (a title that was never
actually saved), confirmed the test suite actually failed, then
reverted. Cheap enough to do every time a nontrivial assertion goes in,
and it's the only way to know a test can actually catch a regression
rather than just always passing regardless of what the code does.

Found and fixed a real, project-wide lint gap while writing these —
not a false alarm dismissed, but a genuine rule collision. `expect(mock
.method).toHaveBeenCalledWith(...)` is the standard Jest mock-assertion
shape, but `@typescript-eslint/unbound-method` (part of this project's
`recommendedTypeChecked` config) can't distinguish a jest mock function
from a real method that depends on `this` when detached from its
object — a well-known, widely-reported false positive for this exact
rule against Jest specifically. The "correct" fix is
`eslint-plugin-jest`'s own `unbound-method` replacement, which is
jest-aware; decided against pulling in a new lint dependency for one
rule and instead added a `**/*.spec.ts`-scoped override in
`eslint.config.mjs` disabling just that rule there — deliberately
scoped to spec files only, not a project-wide `'off'`, so a genuine
unbound-`this` bug in real `src/` production code still gets caught.

Deliberately left two things out of this step, named rather than
silently skipped: `RolesGuard` still has zero test coverage (guards
only run through Nest's real request pipeline, not a plain DI-
instantiated controller, so testing one properly is its own separate
concern — a good next candidate, not attempted here), and
`app.controller.spec.ts` wasn't touched (already a correct, if
minimal, smoke test — not scaffold-and-forgotten the way the Songs
specs were).

`npm test` now runs 22 tests across 3 suites (was 3 tests, one per
suite, all just `toBeDefined()`). `npx eslint src/` and `npm run
test:e2e` both still clean — this step touched no application
behavior, only test code and lint config.

## 2026-09-15 — RolesGuard unit tests

Third Project 6 testing sub-step, and the natural next one — flagged
in each of the last two entries as the obvious remaining gap, and
arguably higher-stakes than more CRUD tests: this is the actual
authorization logic deciding who can mutate `songs`. A subtle bug here
is a real security gap, not just a missed edge case.

A guard needed a genuinely different test shape, not just a smaller
version of the Songs pattern. `RolesGuard.canActivate(context:
ExecutionContext): boolean` can't be exercised through a
`TestingModule` + direct method call the way `SongsController` could —
there's no real `ExecutionContext` outside an actual HTTP request
going through Nest's pipeline. Built a small hand-written fake instead,
exposing only the three methods the guard actually calls
(`getHandler`, `getClass`, `switchToHttp().getRequest()`), cast through
`unknown`. Deliberately chose that over
`createMock<ExecutionContext>()`: the real interface has a long list of
methods (`getArgs`, `getType`, `switchToRpc`, `switchToWs`, ...) this
guard never touches, and auto-mocking all of them would bury the three
that actually matter under stubs a reader has to mentally filter out.
A hand-built fake makes exactly what's being simulated visible at a
glance — the right tool for a *narrow* interface surface, the same way
`createMock` was the right tool for `Repository<Song>`'s much wider
one in the Songs step.

Covered all five real branches in `canActivate`: no `@Roles(...)`
metadata and empty-array metadata (both hit the same early `return
true`, but tested separately since they're reached via different
`reflector` return values — `undefined` vs. `[]` — and it costs nothing
to confirm both actually take that path); missing `request.user` while
roles are required (the defensive branch — normally unreachable since
`AuthGuard('jwt')` always runs first and populates `user`, but the
guard doesn't *assume* that, so the test doesn't either); a real
role mismatch; and a real role match. Added one more assertion beyond
the branch coverage: confirmed `reflector.getAllAndOverride` is called
with `ROLES_KEY` *and* `[handler, class]` together — not just that some
metadata gets read, but that both the specific route handler and the
controller class are checked, which is what actually lets a
handler-level `@Roles()` override a class-level one.

Same sanity discipline as the Songs step: temporarily flipped one
`toBe(true)` to `toBe(false)`, confirmed the suite genuinely failed,
reverted. Consistency matters more than novelty here — this project
now has an established, repeatable way to prove a test can catch a
real regression, and it's cheap enough to do every time.

`npm test` now runs 28 tests across 4 suites (was 22/3). `npx eslint
src/` and `npm run test:e2e` both still clean — no application
behavior changed, test coverage only.

## 2026-09-15 — Separating dev/prod environments

Fourth Project 6 item, and a smaller change than its roadmap name
suggests — most of the actual work happened back in Project 4 step 1,
when every config value (`DB_HOST`, `JWT_SECRET`, `MONGO_URI`, ...)
moved behind `ConfigService` with Joi validation instead of being
hardcoded. That's the part of "dev vs. prod" that actually matters
most: *which values get supplied*, not different code paths. Locally
that's `.env` (gitignored); on Railway later, the same variable names
get set directly in its dashboard — never a committed
`.env.production` file. This step found the two real gaps that were
actually still open, by reading the current code rather than assuming
the config work already covered everything.

`NODE_ENV` didn't exist anywhere in this codebase at all — not read,
not validated, nothing setting it. Added to `env.validation.ts`'s Joi
schema exactly like every other var. `start:prod` (`node dist/main`,
unchanged since the original scaffold) never set it either, so
production would have been running with whatever's ambient — nothing,
unless a host happens to set it, which isn't something to assume.

The one genuine behavior gap: `SwaggerModule.setup(...)` in `main.ts`
ran unconditionally, so `/api` exposed the full route list and every
auth mechanism's exact shape regardless of environment — fine for
local dev, not necessarily something to leave publicly exposed once
deployed. Decided against tying this to `NODE_ENV` directly and gave
it its own `ENABLE_SWAGGER` var instead — explicit and independently
toggleable, since "is this a production environment" and "should the
API docs be public" are related but not actually the same question (a
staging deploy might well be `NODE_ENV=production`-shaped but still
want docs visible, for instance). Defaults to `true` so the existing
dev workflow needs no new env var to keep working.

Explicitly did *not* touch two things that turned out to already be
fine, rather than "fixing" something that wasn't broken: TypeORM's
`synchronize: false` is already unconditional (migrations-only, a
Project 4 decision, no env-based flip needed), and
`HttpExceptionFilter` already never leaks raw internal error
details — every unexpected failure gets a fixed, generic message
regardless of environment. Also deliberately deferred CORS to the
actual Railway deploy step, since it isn't really a dev-vs-prod
distinction on its own — it matters once there's a real external
client hitting the API from a different origin, which doesn't exist
yet.

Verified against the real running app for every claim, not just
reasoning about the code: default boot still serves Swagger UI at
`/api` (confirmed `200`, no regression to the existing workflow);
flipped `ENABLE_SWAGGER=false` and confirmed `/api` actually `404`s
while `/songs` keeps working normally (the gate doesn't touch anything
it shouldn't); set an invalid `NODE_ENV` and confirmed the app
genuinely refuses to boot with a clear Joi error, connection refused
at the port — not just "should reject it"; built for real
(`npm run build`) and ran `start:prod`, then checked the *actual
running process's* environment via `ps eww <pid> | grep NODE_ENV`
rather than trusting the script text alone — confirmed
`NODE_ENV=production` was genuinely set inside the process. `npm
test`, `npm run test:e2e`, and `npx eslint src/ test/` all still
clean throughout.

## 2026-09-22 — Deploying to Railway, and a real deployment bug

The last two Project 6 items, done together since the second only
exists because of the first: pushing to GitHub was already
continuously true by this point (every step in this project has gone
through a PR), so the actual new work was the Railway deploy itself —
and the roadmap's "fix env-related deployment bugs" bullet turned out
not to be a hypothetical box to check, but something that genuinely
happened on the very first real attempt.

Account creation, linking the GitHub repo, and provisioning Railway's
Postgres/MongoDB plugins all happened directly in Railway's dashboard —
not something to automate away, since account/billing setup is
deliberately the user's own action. Wiring the app's own `DB_*`/
`MONGO_URI` vars to Railway's provisioned databases used Railway's
`${{ServiceName.VAR}}` reference syntax (confirmed the exact variable
names — `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` for
Postgres, `MONGO_URL` for Mongo — by reading Railway's own docs rather
than guessing at plausible-sounding names) rather than copying literal
values by hand — real values supplied by the platform, matching the
"environment separation is about which values get supplied, not
different code paths" framing from the previous step. Generated a
fresh `JWT_SECRET` for production rather than reusing the one sitting
in the local `.env` file.

The first real deploy crashed exactly as expected — the Joi validation
error for the missing required vars, working correctly even in a
completely new environment, which was itself a small confirmation that
Project 4's config work travels correctly. Fixing that surfaced the
first genuine finding: Railway auto-detected and ran the plain `start`
script (`nest start`, the dev-mode command) rather than `start:prod` —
worth catching before assuming the deploy was otherwise fine, since it
meant `NODE_ENV` would never actually become `production` and
migrations would never run.

The dashboard's own "Custom Start Command" field is where this should
have been fixed, and it looked fixed — typed, saved, manually
redeployed. It wasn't: the very next deploy's logs still showed plain
`npm run start`. Tried again, same result. Two failed attempts at the
same UI step is a real signal to stop trusting that path, not a reason
to try a third time — switched to `railway.json`
(`deploy.startCommand`), a committed config file Railway's own docs
confirm takes priority over whatever the dashboard has. This is a
better fix on its own merits too, not just a workaround: like every
other piece of this project's config (`docker-compose.yml`,
`env.validation.ts`, the Jest configs), it's now version-controlled and
visible in the repo, not a manual click sitting invisibly in a
dashboard only one person can see or verify.

Each fix was verified against the *actual deployed app*, not just
re-read logs and assumed correct: after the `railway.json` fix
redeployed, `GET /songs` changed from a raw `500` (the table genuinely
didn't exist — migrations had never run under the wrong start command)
to the real empty-schema shape `{"data":[],"total":0}`, proving the
migration step actually executed this time. Then signed up a real
user against production Postgres, logged in, and called `GET
/auth/profile` with the resulting JWT — a full round trip through the
real deployed database and the fresh production secret, live at
`n-fundamentals-pro-production.up.railway.app`.

Deliberately not chased further in this step: promoting a user to
admin in production to verify song creation and the Mongo-backed
comments flow end-to-end there too. Boot logs already confirm
`MongooseCoreModule` initialized cleanly (a failed Mongo connection
would have failed the whole boot, same as Postgres), and the core
auth+Postgres path is now proven for real — good enough to call this
item done without manufacturing more verification than the roadmap
actually asks for.

This leaves Project 6 mostly done: dev/prod separation, the deploy
itself, a real deployment bug found and fixed, and three solid testing
sub-steps establishing the auto-mocking/spies/E2E pattern. The
"Testing with Jest" item stays intentionally unchecked at the top
level — full coverage of every remaining service/controller was a
deliberate scope decision to defer, not an oversight, back when the
RolesGuard step wrapped up.

## 2026-09-22 — Live comment notifications over WebSockets (Project 7)

First Project 7 sub-step. The roadmap's own example outcome was
"live notifications or chat," left open rather than prescribed — picked
live comment notifications on songs specifically because it continues
real work already in the app (Project 5's Comments) instead of bolting
on an unrelated chat demo just to exercise the technology. Someone
viewing a song's thread now sees new comments and replies the instant
they're posted, no polling.

Same version-compatibility habit as every dependency since the
`@nestjs/config` ESM-major trap: checked `@nestjs/websockets`'s
peerDependencies before installing, found the same shape of trap
again — `latest` wants `@nestjs/core@^12.0.0`, this project runs
`^11.0.1` — and pinned `@nestjs/websockets@^11.2.5` +
`@nestjs/platform-socket.io@^11.2.5` instead of trusting a bare
install. `socket.io` itself came along automatically as a real
(non-peer) dependency of the platform package.

Decided against `@nestjs/event-emitter` for wiring the broadcast,
even though it's the more "decoupled" option — `CommentsService`
injects `CommentsGateway` directly and calls it after a successful
save. Reason: `@nestjs/event-emitter` is Project 10's own named
capstone item ("decouple side effects, e.g. on user signup send a
welcome email"). Reaching for it here, for a single emitter with a
single listener, would both pre-empt that later step and add
indirection this specific relationship doesn't need yet.

Caught a real bug while writing the gateway, not a hypothetical one:
`client.join(...)` in the `subscribeToSong` handler returns a
`Promise<void>` (Socket.IO's join is async for adapter compatibility,
e.g. Redis), and the handler wasn't awaiting it — a real floating
promise, not a style nit, since it meant a client's `subscribeToSong`
acknowledgment could resolve before the join had actually completed.
Caught by ESLint's `no-floating-promises` rather than missed
entirely; fixed by making the handler `async`/`await` rather than
just silencing the warning with `void`, since here the completion
genuinely matters — unlike `main.ts`'s pre-existing bare `bootstrap()`
call, which is fine to leave un-awaited.

No CORS configuration on the gateway, on purpose — the demo page
(`public/realtime-comments.html`) is served by this same Nest app
(`app.useStaticAssets(...)` in `main.ts`, using
`@nestjs/platform-express`'s existing static support rather than
adding a new `@nestjs/serve-static` dependency for something Express
already does), so it's same-origin. Consistent with the "skip CORS
until a real cross-origin client needs it" decision from the Railway
deploy step — still true here, so still skipped.

Verified against the real running app with a scripted client first,
not a manual click-through: a `socket.io-client` script (new
devDependency) connected, subscribed to a real song, and received the
exact broadcast payload while a comment was posted via `curl` in
parallel — proving the whole path end to end, not just that the
server didn't crash. Went a step further than "it broadcasts" to
confirm it actually *scopes* correctly: a second client subscribed to
a different song received nothing when the first song got a new
comment, confirming Socket.IO's room mechanism is doing real
isolation, not just being used decoratively.

The actual browser demo page got its own real pass too, done by the
user directly rather than automated: opened
`realtime-comments.html`, subscribed to a real song, and posted a
comment from a separate window (Swagger UI) — appeared live, no
refresh. Then went further than the walkthrough asked for and opened
the page in **two tabs**, both subscribed to the same song, and
confirmed a single comment reached both simultaneously — a stronger
check than the scripted test in one real way: it proves Socket.IO's
room broadcast actually fans out to multiple concurrent subscribers,
not just the one client the automated check happened to use.

`npm test` (28/4), `npm run test:e2e` (1/1), and `npx eslint src/
test/` all still clean. SWC (the roadmap's other Project 7 bullet)
remains its own separate, later sub-step.

## 2026-09-23 — Speedy Web Compiler, and completing Project 7

Last Project 7 sub-step, deferred from the WebSocket work since it's
orthogonal tooling — a build-speed concern, not part of "live
notifications" as an outcome.

Checked `@swc/core`/`@swc/cli`'s dependency shape before installing,
same habit as every package since the `@nestjs/config` trap — and for
once found genuinely nothing to worry about: unlike almost every
`@nestjs/*` package added this whole project, they declare zero
dependency on `@nestjs/core`'s major version at all. They're generic
compiler tooling Nest's CLI knows how to invoke via its builder
abstraction, not Nest packages themselves.

Added `start:swc` as a new script rather than touching `nest-cli.json`'s
default builder — identical reasoning to `start:hmr`: don't silently
change what every flagless `build`/`start`/`start:dev` command does.
This project now has four ways to run in dev (tsc watch, webpack HMR,
SWC, plus plain debug) — genuinely more than a small learning project
strictly needs, worth naming rather than pretending each addition was
obviously necessary. Kept `--type-check` on despite its cost to SWC's
raw speed advantage — SWC alone is transpile-only, and this project
has made the safety-over-speed call at every prior fork of this shape
(HMR's process-fork trade-off, the E2E ESM transform, `unbound-method`
scoped rather than silenced project-wide).

Hit a real, concrete bug on the very first `start:swc` run, not a
hypothetical: `--watch` crashed immediately with `Cannot find module
'chokidar'`. `@swc/cli` lists it as an *optional* dependency, and npm
had skipped installing it on this platform — the error message said
as much ("Chokidar is likely not supported on your platform"), which
turned out to be misleading; it installs and works fine once added as
an explicit devDependency, so "likely not supported" was really "not
installed," not a real platform incompatibility.

Verified the actual claims a fast compiler + parallel type-checker
makes, not just that the command exits zero: the real speed win (47
files, ~150-260ms per compile, vs. tsc's multi-second cold build);
that decorator metadata survives the swap intact — the standard risk
with SWC + a decorator-heavy framework like Nest — confirmed by every
module (including `CommentsGateway`'s WebSocket message registration)
initializing normally on boot, not just "no compile error"; and that
`--type-check` catches something real, by deliberately changing
`SongsService.findOne`'s parameter type from `number` to `string` and
watching the parallel checker report the exact 5 downstream call
sites it broke (two controllers, an internal `this.findOne()` call,
and the TypeORM `where` clause), then reverting and confirming a
clean `0 issues` pass again.

One honest nuance the walkthrough didn't fully anticipate, worth
recording precisely rather than glossing over: `--type-check` reports
errors clearly, but doesn't actually block anything — SWC compiled and
the (type-broken) app booted and kept serving anyway, both times,
errors and all. The type-checker is a fast, visible feedback signal
running alongside the app, not a gate in front of it. Confirmed every
other existing path — `npm run build` (plain tsc), `npm test`, `npm
run test:e2e`, `npx eslint` — completely unaffected throughout.

This completes all three Project 7 roadmap bullets.

## 2026-09-24 — GraphQL server setup, first Project 8 sub-step

The roadmap names Project 8 "the meatiest branch, treat as its own
mini-course" — 7 pieces, not one step. Sequenced it the way every
other multi-part project here has been: smallest slice that proves
the whole pattern (server boot, code-first types, a resolver actually
calling an existing service) before layering in the other six —
error handling, GraphQL auth, subscriptions, resolver testing,
caching/DataLoader, calling an external REST API — as their own later
sub-steps.

The framing worth being deliberate about from the start: GraphQL
resolvers are a **second API layer over the same domain**, not a
separate app. `SongsResolver` injects the exact same `SongsService`
`SongsController` already uses — no business logic duplicated,
proven concretely later by cross-checking a GraphQL-created song
through the existing REST `GET /songs/:id` and seeing identical data.
Code-first, not schema-first, specifically because it matches a
pattern this project has used since the Swagger step: layer decorators
onto classes that already exist (`@ObjectType()`/`@Field()` join
`Song`/`Artist` right next to their `@ApiProperty()`s;
`@InputType()`/`@ArgsType()` join `CreateSongDto`/`PaginationQueryDto`
right next to their `class-validator` decorators) rather than
maintaining a parallel GraphQL-only type tree that could drift out of
sync with the REST one.

Same version-compatibility habit as every `@nestjs/*` package since
the `@nestjs/config` trap, and the same shape of trap again:
`@nestjs/graphql`/`@nestjs/apollo` `latest` wants
`@nestjs/core@^12.0.0`; this project runs `^11.0.1`. Checked via `npm
view` and pinned `@nestjs/graphql@^13.x` + `@nestjs/apollo@^13.4.5` +
`@apollo/server@^5` — all confirmed compatible before installing.

But the compatibility check didn't catch everything, and that's worth
recording honestly rather than presenting this as a clean pin-and-go:
the very first boot crashed with `The "@as-integrations/express5"
package is missing`. This package wasn't in `@nestjs/apollo`'s own
`peerDependencies` output at all — only the Fastify variant showed up
there, even though this project uses Express
(`@nestjs/platform-express`). The Express integration turned out to
be a separate, undeclared runtime dependency the driver only surfaces
by actually trying to boot, not something `npm view`'s static peer-dep
listing could have caught in advance. Installed
`@as-integrations/express5` (confirmed against the already-installed
`express@5.2.1` first) once the real error named it. Worth
remembering for next time: a peerDependencies check is a strong signal,
not a complete guarantee — some optional/conditional dependencies only
reveal themselves at runtime.

Two things deliberately left undone here, not silently skipped:
mutations have no auth check yet (`createSong`/`updateSong`/
`deleteSong` are wide open) — GraphQL needs its own guard mechanism
(`GqlExecutionContext`, different from the REST `AuthGuard`/
`RolesGuard` pairing), and rebuilding auth for GraphQL is explicitly
its own later roadmap bullet, not something to start early just
because the gap is visible. And "not found" resolves to a clean
`null` (`song(id: 99999)` returns `null`, not an error) — the
standard GraphQL idiom for a missing single-item query, not the
REST-style thrown 404; proper GraphQL error handling is also its own
later sub-step.

`schema.gql`, generated automatically from the decorators
(`autoSchemaFile` in `app.module.ts`), gets committed rather than
gitignored — a real, diffable artifact showing exactly what the API
surface looks like, the same treatment as the generated migration
files and `railway.json`.

Verified against the real running app end to end, not just that it
compiled: a `songs` query returned real existing Postgres data (songs
from earlier verification steps in this project, artists nested
correctly); a `createSong` mutation persisted a song immediately
visible through the existing REST endpoint; `updateSong` and
`deleteSong` both confirmed the same way, including the deleted
song's REST endpoint genuinely returning `404` afterward — proof the
two API layers aren't just structurally similar, they're reading and
writing the identical underlying data. `npm test` (28/4), `npm run
test:e2e` (1/1), and `npx eslint src/ test/` all confirmed completely
unaffected.

## 2026-09-24 — Error handling in GraphQL, and a bug that made it real

Second Project 8 sub-step. Didn't start from the roadmap bullet in the
abstract — tested the GraphQL layer directly first, the same way every
"is this actually done" question in this project gets answered, and
found the step already had a genuine reason to exist: any
`HttpException` thrown inside a resolver, including every
`class-validator` failure on `createSong`'s own input, crashed with
`response.status is not a function` and leaked a full internal stack
trace to the client. Not a hypothetical gap — an actively broken path,
reachable by anyone sending slightly malformed GraphQL input.

Root cause, and worth being precise about rather than reaching for the
first plausible-sounding fix: `HttpExceptionFilter`
(`src/common/filters/http-exception.filter.ts`) is globally registered
in `main.ts` and assumes every exception it catches has a real Express
`Response` to call `.status().json()` on. True for REST. GraphQL
resolvers run through a completely different Nest pathway —
`ExternalExceptionsHandler`, not `ExceptionsHandler` — where no such
response object exists, so the filter's own attempt to use it threw a
second, unhandled error on top of whatever the original exception was.

Before reaching for "just add a second filter for GraphQL," actually
read how Nest resolves multiple registered filters —
`@nestjs/core/exceptions/{base-exception-filter-context,
external-exceptions-handler, external-exception-filter-context}.js`
and `helpers/context-creator.js` — rather than guess. What it does:
merges `[...global, ...class, ...method]`-scoped filters, reverses the
whole array (method/class-scoped filters get tried first), then picks
the *first* one whose `@Catch()` type matches via `Array.find()`. Two
separate globally-registered filters both declaring `@Catch
(HttpException)` would genuinely compete for the same exception with
no clear "this one wins" guarantee from the code alone — confirmed
directly from source, not inferred. So the fix is deliberately **one
filter, context-aware** — `host.getType<GqlContextType>()` (the exact
string `'graphql'` confirmed from `@nestjs/graphql`'s own
`gql-execution-context.d.ts`, not guessed either) branches between the
REST path (unchanged, still writes to the real response) and a new
GraphQL path that returns a `GraphQLError` for Apollo to serialize
instead.

Closed out a decision step 1 deliberately deferred at the same time:
`song`/`updateSong`/`deleteSong` now throw a real `NotFoundException`
(same messages as `SongsController`'s REST equivalents) instead of
returning `null`/`false`. That wasn't just "more correct" in the
abstract — it's what actually gives the new filter something real to
prove itself against; returning `null` everywhere would have meant
shipping an error filter with nothing in this resolver left to
exercise it. `schema.gql` picked up the honest consequence: `song` and
`updateSong` now show `Song!`, not `Song` — they genuinely can't
return nothing anymore.

One verification step worth calling out specifically, because it's
the kind of thing that's easy to declare "fixed" prematurely: after
the fix, a dev-mode GraphQL error still showed a `stacktrace` array in
`extensions`. Rather than assume that was leftover from the bug or
add code to strip it, checked what it actually was first — built for
real (`npm run build`) and ran `start:prod`, and the stack trace
disappeared entirely. It's Apollo Server's own standard, intentional,
`NODE_ENV`-gated dev convenience, not a leak this filter introduced or
needs to suppress. Worth the extra step rather than either declaring
victory on a probably-fine assumption or writing unnecessary
stack-trace-stripping code for something already handled correctly
one layer up.

Verified everything end to end against the real running app: the
exact original bug repro (invalid `releaseDate`) now returns the real
validation message with a sensible `extensions.code`, not a crash;
all three not-found cases (`song`, `updateSong`, `deleteSong`) throw
properly with the right status and message; the full create → update
→ delete happy path still works via GraphQL, cross-checked against
REST at every step including the deleted song's REST endpoint
genuinely `404`ing afterward; and a real REST error's shape is
byte-for-byte identical to before this change — proof the fix is
additive, not a rewrite that happened to also work. `npm test`
(28/4), `npm run test:e2e` (1/1), and `npx eslint src/ test/` all
still clean.
