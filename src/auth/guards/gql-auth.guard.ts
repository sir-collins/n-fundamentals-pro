import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * `AuthGuard('jwt')` for GraphQL resolvers. Only `getRequest` is
 * overridden, because the default reads the HTTP context, which holds no
 * request under GraphQL; `JwtStrategy` is reused unchanged.
 */
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext<{ req: unknown }>()
      .req;
  }
}
