import { describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AppThrottlerGuard } from './app-throttler.guard';

// Only the pass-through branches; real throttling is covered end to end in
// test/throttling.e2e-spec.ts.
const guard = Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;

const contextOfType = (type: string) =>
  ({ getType: () => type }) as unknown as ExecutionContext;

describe('AppThrottlerGuard', () => {
  it('lets WebSocket messages through', async () => {
    await expect(guard.canActivate(contextOfType('ws'))).resolves.toBe(true);
  });

  it('lets GraphQL subscriptions (no HTTP request) through', async () => {
    jest
      .spyOn(GqlExecutionContext, 'create')
      .mockReturnValue({ getContext: () => ({}) } as GqlExecutionContext);

    await expect(guard.canActivate(contextOfType('graphql'))).resolves.toBe(
      true,
    );
  });
});
