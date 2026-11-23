import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

/**
 * Enforces `@Roles(...)` metadata with a 403. Must run after an
 * authentication guard (`AuthGuard('jwt')`, `ApiKeyGuard`, `GqlAuthGuard`)
 * so `req.user` is populated. Routes without `@Roles` are not restricted.
 *
 * Handles REST and GraphQL in one class: under GraphQL,
 * `switchToHttp().getRequest()` is `undefined`, so the request is read
 * from the GraphQL context instead.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request =
      context.getType<GqlContextType>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext<{
            req: Request & { user?: { role: UserRole } };
          }>().req
        : context
            .switchToHttp()
            .getRequest<Request & { user?: { role: UserRole } }>();

    if (!request.user || !requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('Insufficient role for this action');
    }

    return true;
  }
}
