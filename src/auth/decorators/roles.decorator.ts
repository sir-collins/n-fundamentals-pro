import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Marks a route handler (or an entire controller) as restricted to the
 * given roles. Attaches metadata only — `RolesGuard` is what actually
 * reads it and decides. A handler with no `@Roles(...)` at all isn't
 * restricted by that guard.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
