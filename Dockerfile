# syntax=docker/dockerfile:1

# ---- deps: full install (dev deps needed to build and to migrate) ----
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate`, writing the client to src/generated.
RUN npm ci

# ---- build: compile TypeScript (including the generated Prisma client) ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- migrate: one-off job applying TypeORM and Prisma migrations ----
FROM build AS migrate
CMD ["sh", "-c", "npm run migration:run && npm run prisma:migrate"]

# ---- runtime: production deps and compiled output only ----
# Dev tools that @prisma/client lists as optional peers (prisma,
# typescript) are "devOptional" in the lockfile, so only omitting both dev
# and optional keeps them out (`npm prune --omit=dev` doesn't).
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# The app writes schema.gql (GraphQL code-first) and uploads/ at runtime.
RUN chown node:node /app
COPY --chown=node:node package.json package-lock.json ./
# --ignore-scripts skips postinstall (`prisma generate`; the client is
# already compiled into dist). bcrypt loads its bundled prebuilt binary.
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public
USER node
RUN mkdir uploads
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "dist/main"]
