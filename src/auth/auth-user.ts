import type { User } from '../users/entities/user.entity';

/**
 * The authenticated caller as it sits on `req.user` once a guard has run.
 * `JwtStrategy.validate` and `ApiKeyGuard` both produce exactly this shape,
 * and `@CurrentUser()` hands it to handlers. Defined once here so the
 * three can't drift apart.
 *
 * Not used by `POST /auth/login`: there `req.user` comes from
 * `LocalStrategy`, which also includes `isTwoFactorEnabled`.
 */
export type AuthUser = Pick<User, 'id' | 'email' | 'role'>;
