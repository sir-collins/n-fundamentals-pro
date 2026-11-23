import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '../../users/entities/user.entity';
import type { AuthUser } from '../auth-user';

/**
 * Bearer-token strategy behind `AuthGuard('jwt')`.
 *
 * Trusts the decoded payload as `req.user` without a database lookup.
 * Trade-off: a user deleted or changed after a token was issued still
 * passes until the token expires.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Same key JwtModule signs with in auth.module.ts.
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * @throws UnauthorizedException if this is a pending-2FA `tempToken`. It
   *   is validly signed, so without this check it would work as a full
   *   session on every JWT-guarded route and bypass 2FA.
   */
  validate(payload: {
    sub: number;
    email?: string;
    role?: UserRole;
    twoFactorPending?: boolean;
  }): AuthUser {
    if (payload.twoFactorPending || !payload.email || !payload.role) {
      throw new UnauthorizedException('Invalid or incomplete session token');
    }

    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
