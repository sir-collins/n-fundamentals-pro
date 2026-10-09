import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysService } from '../api-keys.service';
import { User, UserRole } from '../../users/entities/user.entity';

interface FakeRequest {
  headers: Record<string, string>;
  user?: unknown;
  header(name: string): string | undefined;
}

// Same approach as roles.guard.spec.ts: a hand-built partial context with
// only what the guard touches — switchToHttp().getRequest(), and the
// request's `header()` lookup.
function buildRequest(headers: Record<string, string> = {}): FakeRequest {
  return {
    headers,
    header: (name) => headers[name.toLowerCase()],
  };
}

function buildContext(request: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let apiKeysService: DeepMocked<ApiKeysService>;

  beforeEach(() => {
    apiKeysService = createMock<ApiKeysService>();
    guard = new ApiKeyGuard(apiKeysService);
  });

  it('rejects a request with no x-api-key header', async () => {
    await expect(
      guard.canActivate(buildContext(buildRequest())),
    ).rejects.toThrow(UnauthorizedException);
    expect(apiKeysService.validateKey).not.toHaveBeenCalled();
  });

  it('rejects a key that matches no stored key', async () => {
    apiKeysService.validateKey.mockResolvedValue(null);

    await expect(
      guard.canActivate(buildContext(buildRequest({ 'x-api-key': 'unknown' }))),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('lets a valid key through, attaching only id, email and role', async () => {
    apiKeysService.validateKey.mockResolvedValue({
      id: 1,
      email: 'ada@example.com',
      role: UserRole.ADMIN,
      password: '$2b$10$hashed',
      twoFactorSecret: 'SECRET',
    } as User);
    const request = buildRequest({ 'x-api-key': 'raw-key' });

    expect(await guard.canActivate(buildContext(request))).toBe(true);
    expect(apiKeysService.validateKey).toHaveBeenCalledWith('raw-key');
    // Same shape JwtStrategy produces — and nothing sensitive comes along.
    expect(request.user).toEqual({
      id: 1,
      email: 'ada@example.com',
      role: UserRole.ADMIN,
    });
  });
});
