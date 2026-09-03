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

Currently mid–**Project 3: Authentication & Authorization**. See
[`docs/01-progress.md`](./docs/01-progress.md) for the live checklist
across every project in the roadmap.
