import type { User } from '../users/entities/user.entity';

/**
 * The authenticated caller on `req.user`, as set by `JwtStrategy` and
 * `ApiKeyGuard` and read by `@CurrentUser()`. Not used by `POST /auth/login`,
 * where `LocalStrategy` also adds `isTwoFactorEnabled`.
 */
export type AuthUser = Pick<User, 'id' | 'email' | 'role'>;
