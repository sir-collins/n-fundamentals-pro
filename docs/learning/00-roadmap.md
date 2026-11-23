# NestJS Learning Roadmap — Project-Based Path

Based on: freeCodeCamp's "Learn NestJS" course (Haider Malik)

The idea: instead of watching module-by-module, you build **one evolving app** (a blog/task API works well) across 6 projects, then branch into 3 specialized side-projects for GraphQL, Prisma, and advanced patterns. Each project has a clear "you can now build X" outcome.

---

## Project 1: Your First REST API
**Covers Modules 0–2 (00:00 – 00:52)**

Build a simple resource API (e.g. `/tasks` or `/posts`) from scratch.

- Set up a NestJS project, understand the folder structure
- Build a Controller + Service + Module (the core NestJS trio)
- Add Middleware (e.g. a request logger)
- Add an Exception Filter for consistent error responses
- Use `ParseIntPipe` to validate route params
- Use `class-validator` to validate request bodies (DTOs)

**Outcome:** a working, validated CRUD API with no database yet (in-memory array).

---

## Project 2: Add a Real Database
**Covers Modules 3–5 (00:52 – 02:43)**

Swap your in-memory array for Postgres/MySQL via TypeORM.

- Custom Providers & Injection Scopes (understand DI beyond the basics)
- Connect to a database, create your first Entity
- Real CRUD against the DB + Pagination
- Model relationships: One-to-Many, One-to-One, Many-to-Many
  (e.g. User → Posts, Post → Category, Post ↔ Tags)

**Outcome:** a relational, persistent API — this becomes your base app for the rest of the course.

---

## Project 3: Authentication & Authorization
**Covers Module 6 (02:43 – 04:32)**

Lock down your API.

- User Signup / Login
- JWT authentication via Passport
- Role-Based Access Control (e.g. admin vs user)
- Two-Factor Authentication
- API Key authentication (for a second type of client, e.g. server-to-server)

**Outcome:** a properly secured multi-role API.

---

## Project 4: Production-Grade Setup
**Covers Modules 7–9 (04:32 – 06:11)**

Make the app maintainable and demo-ready.

- Debugging a NestJS app
- Migrations (instead of auto-sync) + Seeding sample data
- Custom configuration + validated environment variables
- Hot Module Reloading for faster dev loop
- Swagger/OpenAPI docs, including documenting auth flows

**Outcome:** an app with proper docs, safe schema changes, and clean config management.

---

## Project 5: Add MongoDB Alongside SQL
**Covers Module 10 (06:11 – 06:52)**

Add a NoSQL piece to the same app (e.g. store activity logs or comments in Mongo while core data stays relational).

- Run MongoDB via Docker Compose
- Connect NestJS to MongoDB, define a Schema
- Save, find, delete records; Populate references

**Outcome:** hands-on experience with polyglot persistence (SQL + NoSQL in one app).

---

## Project 6: Ship It
**Covers Modules 11–12 (06:52 – 08:41)**

Deploy and test the app you've been building.

- Separate dev/prod environments
- Push to GitHub, deploy to Railway
- Fix env-related deployment bugs (very common — good learning moment)
- Testing with Jest: auto-mocking, spies, unit tests for controllers & services, E2E tests

**Outcome:** a deployed, tested, real API you can link to in a portfolio.

---

## Project 7 (Branch A): Real-Time Layer
**Covers Module 13 (08:41 – 09:05)**

- Speedy Web Compiler setup with Nest v10
- Build a WebSocket server
- Send messages from a small frontend page

**Outcome:** add live notifications or chat to your app.

---

## Project 8 (Branch B): GraphQL API
**Covers Modules 14–18 (09:05 – 11:20)** — meatiest branch, treat as its own mini-course

- Set up a GraphQL server; define Queries & Mutations; resolve them
- Error handling in GraphQL
- Re-implement your auth (signup/login) as GraphQL schema + resolvers, guarded
- Real-time Subscriptions (GraphQL's version of WebSockets)
- Unit + E2E testing for resolvers
- Server-side caching (Apollo), Data Loader for N+1 query optimization
- Call an external REST API from within a resolver

**Outcome:** a parallel GraphQL API for the same domain — great for understanding REST vs GraphQL trade-offs firsthand.

---

## Project 9 (Branch C): Rebuild Data Layer with Prisma
**Covers Module 19 (11:20 – 12:46)**

Rebuild Project 2's data layer using Prisma instead of TypeORM, to compare ORMs directly.

- Setup, models & migrations, generate client
- CRUD (Create/Find/Update/Delete)
- All three relation types again, but Prisma-style
- Bulk/batch operations
- Transactions: nested queries + interactive transactions

**Outcome:** you'll deeply understand *why* people choose Prisma vs TypeORM.

---

## Project 10: Capstone — Advanced Feature Grab Bag
**Covers Module 20 (12:46 – end)**

Pick 3–4 of these and bolt them onto your main app:

- File upload (e.g. profile pictures / attachments)
- Custom decorators (e.g. `@CurrentUser()`)
- CRON scheduling (e.g. nightly cleanup job)
- Cookies + Sessions (alternative to JWT-only auth)
- Queues (background jobs, e.g. sending emails async)
- Event Emitter (decouple side effects, e.g. "on user signup, send welcome email")
- Streaming (e.g. large file download)

**Outcome:** a genuinely production-flavored app touching most real-world backend concerns.

---

## Suggested pacing
Projects 1–6 are sequential and build on the same codebase — don't skip ahead. Projects 7/8/9 (WebSockets, GraphQL, Prisma) can be done in any order, or in parallel if you want variety. Project 10 is a "use what you've learned" wrap-up.
