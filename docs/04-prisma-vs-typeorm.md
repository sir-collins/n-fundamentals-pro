# Prisma vs TypeORM, measured in this app

Project 9 rebuilt Project 2's data layer with Prisma and ran it next to
TypeORM: `/songs` uses TypeORM, and `/prisma/songs` (plus the albums,
lyrics, bulk and import routes) uses Prisma. Both talk to the same
Postgres, in different schemas (`public` and `prisma`). This document
compares the two from what we actually built and measured, not from
feature lists. The *why* of each step is in [`03-journal.md`](./03-journal.md).

Versions: TypeORM 1.1.0, Prisma **7.10.0** (pinned exactly, see
[Friction](#tooling-friction)), Postgres 16.

---

## Modelling: entity-first vs schema-first

| | TypeORM | Prisma |
|---|---|---|
| Source of truth | Decorated classes, e.g. [`song.entity.ts`](../src/songs/entities/song.entity.ts) | One file, [`prisma/schema.prisma`](../prisma/schema.prisma) |
| Many-to-many | `@ManyToMany` on both sides, with `@JoinTable` on the owning side | Lists on both sides; Prisma owns the join table (`_ArtistToSong`, columns `A`/`B`) |
| One-to-one | `@OneToOne` on both sides, with `@JoinColumn` on the side that holds the key | A `@unique` foreign key; that one attribute is the whole difference from one-to-many |

Prisma's schema reads as a description of the database. TypeORM's entities
are the database *and* the app's runtime classes at once. Each choice has
consequences, covered in the next section.

## Types: generated vs decorated

Prisma generates TypeScript types (`src/generated/prisma`) from the schema.
They're precise: `Prisma.ArtistGetPayload<{ include: … }>` derives the
exact shape of a query's result, so the type can't drift from the query
([`prisma-relations.service.ts`](../src/prisma-relations/prisma-relations.service.ts)).

The cost is that **those types vanish at runtime**. Nothing can carry
`@ApiProperty()`, so Swagger documents the Prisma routes with TypeORM's
`Song` class. TypeORM's entity is a real class, so it can serve as the
Swagger model, the GraphQL `@ObjectType` and the database mapping at once.

## Migrations

Both generate SQL from model changes, and both SQL files were reviewed
before they ran (`src/database/migrations/` and `prisma/migrations/`).
Differences we hit:
- **Prisma Migrate treats anything in its schema it didn't create as
  drift** and offers to reset the database. Running it next to TypeORM
  only worked once it had its own Postgres schema.
- **`migrate dev` asks for interactive confirmation** for some changes,
  such as a new unique key, which a non-interactive run can't answer.
  `migrate diff` plus a hand-placed migration was the workaround.
- TypeORM migrations are TypeScript classes with `up`/`down`. Prisma's
  are plain SQL with no `down`.

## Queries, as the database saw them

Measured with `log_statement = 'all'` on Postgres, running the same
request through both routes. The counts are statements actually sent.
`tx` means wrapped in `BEGIN`/`COMMIT`.

| Operation | TypeORM (`/songs`) | Prisma (`/prisma/songs`) |
|---|---|---|
| **Create** (one existing, one new artist) | 4: artist `SELECT` (no tx), **one tx for the new artist**, then **a second tx** for the song + join rows | 8 in **one tx**: song `INSERT`; per artist `SELECT` then `INSERT` if missing, plus the join `INSERT … ON CONFLICT DO NOTHING`; then 2 `SELECT`s to return it |
| **Update** (one field + artists) | 7: **5 `SELECT`s** (load the song, find the artists, reload to diff), then a tx with `UPDATE` + `DELETE` of the **one** removed link | 7 in one tx: `UPDATE … RETURNING`; read the links; **`DELETE` all** of them; look up and **re-`INSERT`** the kept one; 2 `SELECT`s to return it |
| **List** (page + total) | 3, **no transaction** | 3 in a `REPEATABLE READ` tx (sub-step 5) |
| **Update a missing id** | 1 `SELECT`, which finds nothing, so `null` | `BEGIN`, `UPDATE` matching 0 rows, `ROLLBACK`, which surfaces as P2025 |
| **Delete** | 1 `DELETE` | 1 `DELETE … RETURNING` |

What the numbers show:
- **"Prisma's update is one query" (journal, sub-step 2) was about API
  calls, not SQL.** The update is one *call*, but 7 statements, the same
  count as TypeORM's load, merge and save. The difference is the shape:
  Prisma writes first and reads once, while TypeORM reads everything and
  then diffs.
- **TypeORM's create isn't atomic.** A new artist is committed in its own
  transaction before the song's transaction starts. If the song insert
  failed, the artist would stay behind as an orphan. Prisma's nested write
  is one transaction.
- **Diffing vs replacing.** TypeORM deleted only the link that went away.
  Prisma's `set: []` deletes every link and re-inserts the ones that stay.
  It's simpler to write, but it costs more writes when little changes.
- **TypeORM's `findAndCount` has the gap that sub-step 5 closed on the
  Prisma side**: its three queries share no snapshot. `/songs` still has
  it (left as is; Project 2's route, out of scope here).
- **`connectOrCreate` is a `SELECT` then an `INSERT`, not an upsert.** That's
  why two concurrent creates of the same new artist can collide (`P2002`).
  TypeORM's `findOrCreateMany` has the same race.

## Missing rows and errors

| | TypeORM | Prisma |
|---|---|---|
| `update`/`delete` of a missing id | `null` / `affected: 0` | Throws **P2025** |
| Nested `connect` to a missing row | n/a | P2025 (Prisma checks first) |
| Raw FK column in a bulk insert | n/a | **P2003** (the database's FK error) |
| Duplicate unique key | A generic `QueryFailedError` (the driver's error, uncoded) | **P2002** |

Prisma's errors are typed and coded, which is more precise but also more
to handle. Every Prisma service here translates the codes it expects
(`isNotFound` in [`prisma-errors.ts`](../src/prisma/prisma-errors.ts)),
so nothing above the service knows them.

## Relations, bulk and transactions

- **Relation filters**, such as `songs: { none: {} }` inside `deleteMany`,
  became one SQL statement with subqueries. TypeORM's `repo.delete()` only
  takes column criteria, so the same thing needs a QueryBuilder.
- **Bulk**: `createManyAndReturn` + `skipDuplicates` (`ON CONFLICT DO
  NOTHING`), and `updateMany`/`deleteMany` returning `{ count }`. Clean,
  but they take raw foreign-key columns (no `connect`), and `createMany`
  can't attach many-to-many relations.
- **Transactions**: nested writes (implicit), batch `$transaction([…])`
  and interactive `$transaction(async tx => …)`. TypeORM has
  `dataSource.transaction(manager => …)`, with no array form. In either
  ORM, **a transaction alone doesn't fix read consistency**: under Read
  Committed, each statement gets its own snapshot. You need
  `isolationLevel: RepeatableRead`, and the log above shows Prisma sending
  it.

## The mass-assignment finding

The parity suite ([`test/songs-parity.e2e-spec.ts`](../test/songs-parity.e2e-spec.ts))
runs identical scenarios against both routes. Everything matched except
one case: **an `id` in the request body.** The global `ValidationPipe` had
no `whitelist`, so unknown properties reached both services, which copy
the body into the entity. The same bug failed in two different ways:

| Request | TypeORM | Prisma |
|---|---|---|
| `POST` with `"id": 220` (an existing song) | `save()` treats a set id as an upsert: `SELECT` 220, then **`UPDATE "song" SET "title"…` — song 220 overwritten, 201 returned** | `INSERT … ("id", …)`, **duplicate key → `ROLLBACK` → 500** |
| `PUT /221` with `"id": 220` | `Object.assign` sets the id, then `save()` **updates row 220 with 221's change** | `UPDATE … SET "id" = 220`, **duplicate key → 500** |

TypeORM corrupted data and reported success. Prisma refused, which is
safer, but with a 500. Had the id been *free*, Prisma would have inserted a
row with a client-chosen id, or **renumbered** the song. The fix is the
same for both: `whitelist: true` in
[`configure-app.ts`](../src/configure-app.ts), which strips every
undecorated property before a handler sees the body. It was safe because
every DTO field already had a validator. The routes that already picked
fields by name (bulk update, import) keep doing so as a second layer.

## Testing

- **Unit**: TypeORM repositories mock well with `createMock`. Prisma's
  deep generic types made typed mocks noisy, so the specs use small
  hand-built delegates (`{ song: { create: jest.fn() } }`). That turned out
  to be a strength: tests assert the exact query object sent, and a
  separate `tx` mock catches a query that leaks out of a transaction.
- **E2E**: Prisma's generated client needed a small CommonJS transformer
  for Jest ([`test/prisma-cjs-transformer.js`](../test/prisma-cjs-transformer.js)).

## Tooling friction

- **Version pinning**: when we installed, `prisma@latest` was an 8.0
  release candidate while `@prisma/client@latest` was 7.10, so a plain
  install would have mixed majors. Both are pinned exactly.
- **Driver adapter**: Prisma 7 connects through `@prisma/adapter-pg`. The
  schema is an adapter option, not a `?schema=` in the URL.
- **Generated code**: the client is generated into the project
  (gitignored), so `postinstall: prisma generate` keeps builds working, and
  the generator needed `moduleFormat = "cjs"` and
  `importFileExtension = ""` for Nest and Jest.
- TypeORM's friction was elsewhere: `save()`'s implicit upsert (above),
  `Partial<Dto>` silently disabling validation (sub-step 2), and
  `findAndCount`'s missing snapshot.

## Verdict

**Choose Prisma** when the schema is the centre of the project, and you
want precise, generated types, explicit queries and error codes, and
writes that are transactional by default. It made the risky cases loud:
bad input failed rather than silently writing. The price is tooling
(generation, adapters, version pins), no runtime model classes, and less
control over the SQL shape, as with `set: []`'s delete-and-reinsert.

**Choose TypeORM** when you want one class to be the database row, the
API model and the GraphQL type, or need entity lifecycle and diff-based
saves. Watch `save()`. Its implicit upsert is the most dangerous behaviour
we found in either ORM, and its multi-step writes aren't atomic unless you
wrap them.

**For this app**, Prisma's routes ended up with stronger guarantees (atomic
creates, consistent pagination, failing loudly), while TypeORM's routes
were more convenient to document. Both needed the same app-level fix:
whitelisting input before it reaches any ORM.
