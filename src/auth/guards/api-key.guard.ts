import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiKeysService } from '../api-keys.service';
import type { AuthUser } from '../auth-user';

/**
 * Authenticates a request via the `x-api-key` header. A plain guard rather
 * than a Passport strategy, since a header lookup needs nothing Passport
 * offers.
 *
 * Sets `request.user` to the same shape `JwtStrategy` produces, picked
 * explicitly so the password hash and 2FA secret never ride along, and so
 * downstream code (`RolesGuard` included) can't tell the mechanisms apart.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    const rawKey = request.header('x-api-key');

    if (!rawKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const user = await this.apiKeysService.validateKey(rawKey);

    if (!user) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.user = { id: user.id, email: user.email, role: user.role };
    return true;
  }
}
