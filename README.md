# n-fundamentals-pro

A hands-on NestJS learning project: one evolving API, built step by step
across a project-based roadmap (freeCodeCamp's "Learn NestJS" course),
rather than a bunch of disconnected tutorial snippets.

The resource at the center of it is `songs` (with an `artists`
many-to-many relationship); auth, roles, and 2FA are layered on top as
their own project. See [`docs/`](./docs) for the full roadmap, a
checklist of what's done, and a running build journal explaining *why*
each piece was built the way it was — start at
[`docs/README.md`](./docs/README.md).

## Stack

- **NestJS** (Controllers/Services/Modules, Pipes, Guards, Exception
  Filters, Middleware)
- **PostgreSQL** via **TypeORM**, run locally through `docker-compose.yml`
- **Passport** (`local` + `jwt` strategies) for login and route protection
- **bcrypt** for password hashing, **otplib** + **qrcode** for TOTP-based
  two-factor auth
- **Swagger/OpenAPI** (`@nestjs/swagger`) for interactive, browsable API docs

## Getting started

```bash
# start Postgres
docker compose up -d

# install deps
npm install

# run in watch mode
npm run start:dev
```

The app expects Postgres reachable with the credentials in
`docker-compose.yml` (hardcoded for local dev — see `app.module.ts` and
`docs/03-journal.md` for why, and what changes once Project 4's
environment-config step lands).

A couple of alternate run modes exist alongside plain `start:dev`:
- `npm run start:debug` — opens Node's inspector (port `9229`) for real
  breakpoint debugging; pairs with the `.vscode/launch.json` "Attach to
  Nest" config already in this repo (Run & Debug panel → Attach → F5)
- `npm run start:hmr` — webpack-based Hot Module Reloading (faster
  incremental rebuilds, no process fork on save); see
  `docs/03-journal.md` for why it deliberately uses `nest build`, not
  `nest start`

## API Documentation (Swagger)

Once the app is running, every route — request/response shapes included —
is browsable and directly testable at:

- **UI:** http://localhost:3000/api
- **Raw OpenAPI spec (JSON):** http://localhost:3000/api-json

This API has two independent auth mechanisms, and the UI's **Authorize**
button (padlock icon, top of the page) shows a separate input for each:

- **bearer** — a JWT from `POST /auth/login` (paste just the token, no
  `Bearer ` prefix — Swagger adds it)
- **api-key** — a raw key from `POST /auth/api-keys`, sent as the
  `x-api-key` header

Once authorized, "Try it out" on any route sends a real request with the
right credentials attached automatically. A typical first pass: sign up →
log in → authorize with the resulting token → try `GET /auth/profile` →
mint an API key → authorize with that too → try `GET /auth/api-keys/whoami`
via the key instead. See `docs/01-progress.md` and `docs/03-journal.md`
for how this was built and verified.

## Testing

```bash
npm run test        # unit tests
npm run test:e2e     # e2e tests
npm run test:cov     # coverage
```

For manual, real-HTTP testing there's [`rest-client.http`](./rest-client.http)
— a set of ready-to-run requests (signup, login, 2FA, RBAC-guarded `songs`
mutations, etc.) meant for VS Code's REST Client extension, kept in sync
with the API as new endpoints are added.

## Project status

**Project 4: Production-Grade Setup** is complete — env config/validation,
migrations + seeding, debugging tooling, Hot Module Reloading, and
Swagger/OpenAPI docs. Next up: **Project 5**, adding MongoDB alongside the
existing Postgres/TypeORM data layer. See
[`docs/01-progress.md`](./docs/01-progress.md) for the live checklist
across every project in the roadmap.
