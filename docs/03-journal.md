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
