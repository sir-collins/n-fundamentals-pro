import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiKeysService } from '../api-keys.service';
import { UserRole } from '../../users/entities/user.entity';

/**
 * Authenticates a request via the `x-api-key` header instead of a JWT
 * bearer token — the machine-to-machine counterpart to `JwtStrategy`.
 * Deliberately a plain `CanActivate`, not a Passport strategy: a header
 * lookup + hash + DB match doesn't need Passport's abstraction the way
 * login (local) or bearer-token (jwt) auth does.
 *
 * On success, sets `request.user` to the same `{ id, email, role }` shape
 * `JwtStrategy.validate` produces — so anything downstream (`RolesGuard`
 * included) can't tell which mechanism authenticated the request.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<
        Request & { user?: { id: number; email: string; role: UserRole } }
      >();

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
