import { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { currentUserFactory } from './current-user.decorator';
import { UserRole } from '../../users/entities/user.entity';
import type { AuthUser } from '../auth-user';

const user: AuthUser = { id: 7, email: 'me@example.com', role: UserRole.USER };

// Hand-built partial contexts, same style as roles.guard.spec.ts — only
// the methods the factory (and GqlExecutionContext.create) actually touch.
function httpContext(reqUser?: AuthUser): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ user: reqUser }) }),
  } as unknown as ExecutionContext;
}

// GqlExecutionContext.create reads the resolver args
// [root, args, context, info]; the GraphQL context (index 2) holds `req`.
// switchToHttp() returns undefined, like it does for real in GraphQL.
function graphqlContext(reqUser?: AuthUser): ExecutionContext {
  return {
    getType: () => 'graphql',
    getArgs: () => [{}, {}, { req: { user: reqUser } }, {}],
    getClass: () => undefined,
    getHandler: () => undefined,
    switchToHttp: () => ({ getRequest: () => undefined }),
  } as unknown as ExecutionContext;
}

describe('currentUserFactory', () => {
  describe('HTTP', () => {
    it('returns the whole user when no field is named', () => {
      expect(currentUserFactory(undefined, httpContext(user))).toBe(user);
    });

    it('returns just the named field', () => {
      expect(currentUserFactory('id', httpContext(user))).toBe(7);
      expect(currentUserFactory('role', httpContext(user))).toBe(UserRole.USER);
    });

    it('returns undefined when no guard set req.user', () => {
      expect(currentUserFactory(undefined, httpContext())).toBeUndefined();
      expect(currentUserFactory('id', httpContext())).toBeUndefined();
    });
  });

  describe('GraphQL', () => {
    it('reads the user from the GraphQL context, not switchToHttp()', () => {
      expect(currentUserFactory(undefined, graphqlContext(user))).toBe(user);
      expect(currentUserFactory('email', graphqlContext(user))).toBe(
        'me@example.com',
      );
    });

    it('returns undefined when no guard set req.user', () => {
      expect(currentUserFactory(undefined, graphqlContext())).toBeUndefined();
    });
  });
});
