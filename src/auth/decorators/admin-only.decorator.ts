import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/**
 * Restricts a REST route to authenticated admins and documents it in
 * Swagger (bearer auth, 401, 403). `AuthGuard('jwt')` must run before
 * `RolesGuard`, which reads the user it attaches.
 */
export const AdminOnly = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Missing/invalid JWT.' }),
    ApiResponse({ status: 403, description: 'Authenticated but not admin.' }),
    UseGuards(AuthGuard('jwt'), RolesGuard),
    Roles(UserRole.ADMIN),
  );
