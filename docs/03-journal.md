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

Verified end to end, not just "it compiles": booted the app, confirmed
`synchronize: true` created the `song` table (visible via
`docker exec ... psql -c '\dt'`); ran create/read/update/delete through the
real HTTP API; independently re-read the row with a direct `psql` query
(bypassing the app entirely) to confirm it was really in Postgres and not
some other cache; killed the running app process and restarted it, and the
previously-created song was still there. That last check is the actual
point of Project 2 — Project 1's in-memory array would have lost everything
on that restart.
