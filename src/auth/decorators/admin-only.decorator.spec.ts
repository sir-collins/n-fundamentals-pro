import { describe, expect, it } from '@jest/globals';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '../../users/entities/user.entity';
import { RolesGuard } from '../guards/roles.guard';
import { AdminOnly } from './admin-only.decorator';
import { ROLES_KEY } from './roles.decorator';

// @nestjs/swagger's metadata keys (not exported from its public entry).
const API_SECURITY = 'swagger/apiSecurity';
const API_RESPONSE = 'swagger/apiResponse';

class Target {
  @AdminOnly()
  handler(): void {}
}

const handler = Object.getOwnPropertyDescriptor(Target.prototype, 'handler')!
  .value as object;

describe('AdminOnly', () => {
  it('requires a JWT, then the admin role', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];

    expect(guards).toHaveLength(2);
    expect(guards[1]).toBe(RolesGuard);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.ADMIN]);
  });

  it('documents bearer auth and the 401/403 responses', () => {
    expect(Reflect.getMetadata(API_SECURITY, handler)).toEqual([
      { bearer: [] },
    ]);
    expect(
      Object.keys(Reflect.getMetadata(API_RESPONSE, handler) as object),
    ).toEqual(expect.arrayContaining(['401', '403']));
  });
});
