import { Prisma } from '../generated/prisma/client';

/**
 * Whether `error` is Prisma's P2025 — "a record this operation needs was
 * not found". Thrown by `update`/`delete` for a missing row (where
 * TypeORM reports `null`/`affected: 0`), and by a nested `connect` whose
 * target is missing — Prisma checks before inserting, so that surfaces
 * as P2025 rather than the database's foreign-key violation (P2003).
 *
 * Services translate it to `null`/`false`, so nothing above them knows
 * Prisma error codes.
 */
export function isNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}
