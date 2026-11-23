import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import type { AuthUser } from '../auth-user';

type RequestWithUser = Request & { user?: AuthUser };

/**
 * Factory behind `@CurrentUser()`, exported so it can be unit-tested
 * directly. In GraphQL, `switchToHttp().getRequest()` is `undefined`, so
 * the request comes from the GraphQL context instead.
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
 * Injects the authenticated caller (or one field of it) into a REST or
 * GraphQL handler:
 *
 *   profile(@CurrentUser() user: AuthUser)
 *   listKeys(@CurrentUser('id') userId: number)
 *
 * Does no authentication itself: it reads `req.user` as set by a guard,
 * and injects `undefined` on an unguarded route.
 */
export const CurrentUser = createParamDecorator(currentUserFactory);
