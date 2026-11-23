import { Prisma } from '../generated/prisma/client';

/**
 * Whether `error` is Prisma's P2025 ("record not found"). Prisma throws it
 * from `update`/`delete` on a missing row (TypeORM returns `null` /
 * `affected: 0` instead) and from a nested `connect` to a missing target,
 * which Prisma checks before the database can raise a foreign-key error.
 *
 * Services map it to `null`/`false` so callers never see Prisma error codes.
 */
export function isNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}
