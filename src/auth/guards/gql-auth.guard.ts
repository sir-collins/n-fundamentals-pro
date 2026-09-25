import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * `AuthGuard('jwt')`'s GraphQL counterpart. Passport's guard base class
 * calls `getRequest(context)` to find the request to extract a token
 * from — its default assumes a REST `ExecutionContext`
 * (`context.switchToHttp().getRequest()`), which doesn't hold the real
 * request in a GraphQL execution context. Overriding just this one
 * method is enough: the actual JWT verification (`JwtStrategy`) is
 * unchanged and fully reused, since a bearer token in the
 * `Authorization` header looks identical to Express regardless of
 * transport.
 */
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext<{ req: unknown }>()
      .req;
  }
}
