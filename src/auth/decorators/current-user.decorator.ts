import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import type { AuthUser } from '../auth-user';

type RequestWithUser = Request & { user?: AuthUser };

/**
 * Factory behind `@CurrentUser()`, exported on its own so it can be
 * unit-tested directly (a decorator created by `createParamDecorator`
 * can't simply be called).
 *
 * Finds the request the same way `RolesGuard` does: in a GraphQL
 * execution context `switchToHttp().getRequest()` is `undefined`, so the
 * request is taken from the GraphQL context instead.
 */
export function currentUserFactory(
  data: keyof AuthUser | undefined,
  ctx: ExecutionContext,
): AuthUser | AuthUser[keyof AuthUser] | undefined {
  const request =
    ctx.getType<GqlContextType>() === 'graphql'
      ? GqlExecutionContext.create(ctx).getContext<{ req: RequestWithUser }>()
          .req
      : ctx.switchToHttp().getRequest<RequestWithUser>();

  const user = request.user;
  return data ? user?.[data] : user;
}

/**
 * Injects the authenticated caller into a handler argument, for REST and
 * GraphQL alike:
 *
 *   profile(@CurrentUser() user: AuthUser)
 *   listKeys(@CurrentUser('id') userId: number)
 *
 * This does **no authentication**. It only reads what a guard
 * (`AuthGuard('jwt')`, `ApiKeyGuard`, `GqlAuthGuard`) already put on
 * `req.user`. On a route without one of those guards it injects
 * `undefined`.
 */
export const CurrentUser = createParamDecorator(currentUserFactory);
