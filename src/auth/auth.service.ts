import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user.
   *
   * `UsersService.create` returns the full `User` entity, hash included —
   * that's the right internal shape (e.g. login will need the hash to
   * compare against). This is the boundary where it's stripped, so a
   * password hash can never leak into an HTTP response from this path.
   *
   * Fields are picked explicitly rather than destructuring `password` off
   * and returning the rest — an omit-style rest spread would silently
   * start including any new field added to `User` later (a phone number,
   * say) unless someone remembered to exclude it too. `role` is a case in
   * point: deliberately left out of this response (not secret, just not
   * needed here) — visible via a login token or `/auth/profile` instead.
   */
  async signup(dto: SignupDto): Promise<Pick<User, 'id' | 'email'>> {
    const user = await this.usersService.create(dto.email, dto.password);
    return { id: user.id, email: user.email };
  }

  /**
   * Verify an email/password pair against the stored bcrypt hash.
   * @returns the user (without its password hash) if valid, `null`
   *   otherwise — Passport's local-strategy convention: return `null`
   *   rather than throw, so `LocalStrategy.validate` decides how to turn
   *   that into a `401`.
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return null;
    }

    return { id: user.id, email: user.email, role: user.role };
  }

  // Not async: JwtService.sign is synchronous (a separate signAsync exists
  // for when that's actually needed) — this signature says what it does.
  /** Issue a signed JWT for an already-authenticated user. */
  login(user: Omit<User, 'password'>): { access_token: string } {
    // role travels inside the token itself — JwtStrategy trusts the
    // payload directly (no DB lookup per request, see jwt.strategy.ts),
    // so anything a guard needs to check has to be signed in here.
    const payload = { sub: user.id, email: user.email, role: user.role };
    return { access_token: this.jwtService.sign(payload) };
  }
}
