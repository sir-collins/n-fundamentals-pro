import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

// A hand-built partial ExecutionContext, cast through `unknown` — the
// guard only touches getHandler/getClass/getType/switchToHttp().getRequest(),
// so a full createMock<ExecutionContext>() would just obscure which
// methods actually matter here. `getType` returns 'http' since these tests
// exercise the REST branch of the guard's context-aware request lookup.
function buildContext(user?: { role: UserRole }): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: DeepMocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: createMock<Reflector>() },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector);
  });

  it('allows the request when no @Roles(...) metadata is present', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('allows the request when @Roles(...) resolves to an empty array', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('reads metadata from both the handler and the class', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = buildContext();

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('forbids when roles are required but the request has no user', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it("forbids when the caller's role isn't in the required list", () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(() =>
      guard.canActivate(buildContext({ role: UserRole.USER })),
    ).toThrow(ForbiddenException);
  });

  it("allows when the caller's role is in the required list", () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(buildContext({ role: UserRole.ADMIN }))).toBe(
      true,
    );
  });
});
