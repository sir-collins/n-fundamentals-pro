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
- **MongoDB** via **Mongoose** (`@nestjs/mongoose`), also run through
  `docker-compose.yml` — polyglot persistence: comments on songs (with
  threaded replies) live here instead of Postgres
- **Passport** (`local` + `jwt` strategies) for login and route protection
- **bcrypt** for password hashing, **otplib** + **qrcode** for TOTP-based
  two-factor auth
- **Swagger/OpenAPI** (`@nestjs/swagger`) for interactive, browsable API docs
- **WebSockets** (`@nestjs/websockets` + Socket.IO) for live comment
  notifications — see [`public/realtime-comments.html`](./public/realtime-comments.html)
- **GraphQL** (`@nestjs/graphql` + Apollo) at `/graphql` — a parallel,
  code-first API over the same `songs`/`auth`/`comments` domain/services
  as the REST routes, including signup/login/profile,
  JWT+role-guarded song mutations, and a real-time `commentAdded`
  subscription (`graphql-ws`) alongside the WebSocket gateway — see
  [`public/graphql-comment-subscriptions.html`](./public/graphql-comment-subscriptions.html);
  schema at [`schema.gql`](./schema.gql)

## Getting started

```bash
# start Postgres + MongoDB
docker compose up -d

# install deps
npm install

# run in watch mode
npm run start:dev
```

The app expects both databases reachable using the values in `.env`
(copy `.env.example` to `.env` and adjust if needed — every value is
validated at boot by `src/config/env.validation.ts`; a missing or
malformed one makes the app refuse to start with a clear error instead
of failing confusingly later). `docker-compose.yml`'s own credentials
match `.env.example`'s defaults, so the two stay in sync for local dev
with no extra setup.

Two of those values are environment-shaped rather than
connection-shaped: `NODE_ENV` (`development`/`production`/`test`,
defaults to `development`) and `ENABLE_SWAGGER` (defaults to `true` —
see [API Documentation](#api-documentation-swagger) below). Neither is
committed per-environment (no `.env.production` file) — a real
deployment sets its own values directly in its host's dashboard, the
same as every other var here.

A couple of alternate run modes exist alongside plain `start:dev`:
- `npm run start:debug` — opens Node's inspector (port `9229`) for real
  breakpoint debugging; pairs with the `.vscode/launch.json` "Attach to
  Nest" config already in this repo (Run & Debug panel → Attach → F5)
- `npm run start:hmr` — webpack-based Hot Module Reloading (faster
  incremental rebuilds, no process fork on save); see
  `docs/03-journal.md` for why it deliberately uses `nest build`, not
  `nest start`
- `npm run start:swc` — SWC-based compilation (~150-260ms full
  compiles vs. tsc's multi-second cold build), with a parallel
  `tsc --noEmit` pass (`--type-check`) so real type errors still get
  caught — SWC alone is transpile-only

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

## Live deployment

Deployed on Railway: **https://n-fundamentals-pro-production.up.railway.app**
(Swagger docs at [`/api`](https://n-fundamentals-pro-production.up.railway.app/api)).
Its own Postgres and MongoDB instances, separate from local dev.

## Project status

**Projects 4 and 5** are complete. **Project 6: Ship It** is mostly
done — dev/prod environment separation, the Railway deploy above (plus
a real env-related deployment bug found and fixed along the way: see
`docs/03-journal.md`), and three unit-testing sub-steps (E2E suite,
Songs service/controller, `RolesGuard`) establishing the
auto-mocking/spies pattern. Deliberately left open: full test coverage
for the rest of the app (auth's other services, comments) — a scope
decision, not an oversight. **Project 7: Real-Time Layer** is complete
— live comment notifications over WebSockets (see the Stack section
above) and `start:swc` (see "Getting started" above). Now on
**Project 8: GraphQL API** — a parallel `/graphql` API over `songs`,
`auth`, and `comments` is done, including GraphQL-specific error
handling, JWT/role-guarded mutations reusing the same auth system as
REST, and a real-time `commentAdded` subscription alongside the
existing WebSocket gateway (see the Stack section above); resolver
testing, caching, and an external-API-calling resolver are later
sub-steps. See
[`docs/01-progress.md`](./docs/01-progress.md) for the live checklist
across every project in the roadmap.
