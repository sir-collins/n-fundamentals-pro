import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { User } from '../users/entities/user.entity';

// Shown in an authenticator app next to the 6-digit code, so the user can
// tell which account this entry belongs to.
const TWO_FACTOR_APP_NAME = 'NFundamentalsPro';

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
   * @returns the fields `login` needs if valid, `null` otherwise —
   *   Passport's local-strategy convention: return `null` rather than
   *   throw, so `LocalStrategy.validate` decides how to turn that into a
   *   `401`. Deliberately `Pick`, not `Omit<User, 'password'>` — this
   *   result flows into `login`, so it should carry exactly what that
   *   needs (now including `isTwoFactorEnabled`, so `login` can decide
   *   whether to demand a code), not automatically grow every time `User`
   *   gains an unrelated column.
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<Pick<
    User,
    'id' | 'email' | 'role' | 'isTwoFactorEnabled'
  > | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
    };
  }

  // Not async: JwtService.sign is synchronous (a separate signAsync exists
  // for when that's actually needed) — this signature says what it does.
  /**
   * Issue a session for an already-authenticated (password-verified)
   * user. If they have 2FA enabled, this deliberately does NOT issue a
   * full `access_token` yet — that would mean the password alone was
   * still enough to get in. Instead it returns a short-lived `tempToken`
   * that proves "this password check just succeeded, for this specific
   * user" without being usable anywhere else; `authenticateTwoFactor`
   * exchanges it (plus a TOTP code) for the real token.
   */
  login(
    user: Pick<User, 'id' | 'email' | 'role' | 'isTwoFactorEnabled'>,
  ): { access_token: string } | { twoFactorRequired: true; tempToken: string } {
    if (user.isTwoFactorEnabled) {
      const tempToken = this.jwtService.sign(
        { sub: user.id, twoFactorPending: true },
        { expiresIn: '5m' },
      );
      return { twoFactorRequired: true, tempToken };
    }

    // role travels inside the token itself — JwtStrategy trusts the
    // payload directly (no DB lookup per request, see jwt.strategy.ts),
    // so anything a guard needs to check has to be signed in here.
    const payload = { sub: user.id, email: user.email, role: user.role };
    return { access_token: this.jwtService.sign(payload) };
  }

  /**
   * Generate a new TOTP secret for a user and return it as a scannable QR
   * code. Calling this again before `turnOnTwoFactor` just overwrites the
   * previous secret — not a bug, just means only the most recently
   * generated QR code is actually valid to scan.
   */
  async generateTwoFactorSecret(
    userId: number,
    email: string,
  ): Promise<{ qrCodeDataUrl: string }> {
    const secret = authenticator.generateSecret();
    await this.usersService.setTwoFactorSecret(userId, secret);

    const otpauthUrl = authenticator.keyuri(email, TWO_FACTOR_APP_NAME, secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return { qrCodeDataUrl };
  }

  /**
   * Confirm 2FA setup by checking a code from the user's authenticator
   * app against their stored secret. Only flips `isTwoFactorEnabled` once
   * this succeeds — proves the QR code was actually scanned correctly
   * before 2FA starts being enforced anywhere.
   * @throws BadRequestException if no secret was generated yet, or the
   *   code doesn't match — the caller's identity isn't in question here
   *   (they're already authenticated), just whether this specific code is
   *   right.
   */
  async turnOnTwoFactor(userId: number, code: string): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (!user?.twoFactorSecret) {
      throw new BadRequestException(
        'No two-factor secret has been generated for this account yet',
      );
    }

    const isValid = authenticator.check(code, user.twoFactorSecret);

    if (!isValid) {
      throw new BadRequestException('Invalid two-factor code');
    }

    await this.usersService.enableTwoFactor(userId);
  }

  /**
   * Second half of a 2FA login: exchange a `tempToken` (from `login`)
   * plus a TOTP code for a real `access_token`. Deliberately not behind
   * `AuthGuard('jwt')` — the caller doesn't have a real token yet, so the
   * `tempToken` itself is verified manually here, standing in as proof
   * the password check already succeeded for this specific user.
   * @throws UnauthorizedException if `tempToken` is missing, expired, or
   *   isn't actually a pending-2FA token.
   * @throws BadRequestException if `code` doesn't match the user's secret.
   */
  async authenticateTwoFactor(
    tempToken: string,
    code: string,
  ): Promise<{ access_token: string }> {
    let payload: { sub: number; twoFactorPending?: boolean };

    try {
      payload = this.jwtService.verify(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired two-factor session');
    }

    if (!payload.twoFactorPending) {
      throw new UnauthorizedException('Invalid two-factor session');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user?.twoFactorSecret) {
      throw new UnauthorizedException('Invalid two-factor session');
    }

    const isValid = authenticator.check(code, user.twoFactorSecret);

    if (!isValid) {
      throw new BadRequestException('Invalid two-factor code');
    }

    return {
      access_token: this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
    };
  }
}
