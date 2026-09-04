import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_SECRET } from '../auth.module';
import { UserRole } from '../../users/entities/user.entity';

/**
 * Passport strategy backing any route guarded with `AuthGuard('jwt')`.
 * Passport itself extracts the token from the `Authorization: Bearer ...`
 * header and verifies its signature and expiry before `validate` ever
 * runs — a missing/invalid/expired token 401s without reaching this class.
 *
 * `validate` trusts the decoded payload directly as `req.user`, with no
 * database re-lookup — that's the point of a self-contained JWT (no DB
 * round trip to authenticate a request). Trade-off, accepted deliberately
 * for now: a user deleted or changed after a token was issued still
 * passes until that token's own expiry.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  /**
   * @throws UnauthorizedException if this is a short-lived `tempToken`
   *   from a pending 2FA login rather than a real session — otherwise
   *   it's still a validly-signed JWT and would silently work as a full
   *   session on any guarded route, defeating 2FA entirely. This is the
   *   one place every `AuthGuard('jwt')`-protected route goes through, so
   *   the check belongs here rather than repeated per-route.
   */
  validate(payload: {
    sub: number;
    email?: string;
    role?: UserRole;
    twoFactorPending?: boolean;
  }): { id: number; email: string; role: UserRole } {
    if (payload.twoFactorPending || !payload.email || !payload.role) {
      throw new UnauthorizedException('Invalid or incomplete session token');
    }

    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
