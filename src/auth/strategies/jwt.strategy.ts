import { Injectable } from '@nestjs/common';
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

  validate(payload: { sub: number; email: string; role: UserRole }): {
    id: number;
    email: string;
    role: UserRole;
  } {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
