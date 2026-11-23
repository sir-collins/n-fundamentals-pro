import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { GqlContext } from '../graphql-context';

/**
 * The global rate limiter, for REST and GraphQL alike, keyed by client IP.
 *
 * `ThrottlerGuard` only knows HTTP requests. Without the GraphQL branch,
 * every mutation (including `login`) would go unthrottled, and brute force
 * would just move to `/graphql`. WebSocket traffic, including GraphQL
 * subscriptions, isn't throttled.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  canActivate(context: ExecutionContext): Promise<boolean> {
    const type = context.getType<GqlContextType>();

    if (type === 'graphql') {
      const { req } =
        GqlExecutionContext.create(context).getContext<Partial<GqlContext>>();
      if (!req) return Promise.resolve(true);
    } else if (type !== 'http') {
      return Promise.resolve(true);
    }

    return super.canActivate(context);
  }

  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, any>;
    res: Record<string, any>;
  } {
    if (context.getType<GqlContextType>() === 'graphql') {
      const { req } =
        GqlExecutionContext.create(context).getContext<GqlContext>();
      return { req, res: req.res as Response };
    }

    const http = context.switchToHttp();
    return {
      req: http.getRequest<Request>(),
      res: http.getResponse<Response>(),
    };
  }
}
