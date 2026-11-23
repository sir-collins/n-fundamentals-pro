import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { User } from '../users/entities/user.entity';
import {
  USER_CREATED,
  UserCreatedEvent,
} from '../users/events/user-created.event';

// Label shown next to the code in the user's authenticator app.
const TWO_FACTOR_APP_NAME = 'NFundamentalsPro';

// Matches otplib's default TOTP `step`.
const TOTP_STEP_SECONDS = 30;

// Also accept the previous step's code, so a code typed at :29 that arrives
// at :31 isn't rejected (RFC 6238 network-delay tolerance). Safe only
// because of the replay protection in `verifyAndSpendCode`. Note this sets
// options on the shared `authenticator` singleton, app-wide.
authenticator.options = { window: 1 };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Register a new user and emit `user.created`.
   *
   * Fields are picked explicitly rather than omitting `password` with a rest
   * spread, so the hash can never leak and new `User` columns don't appear
   * in the response by accident.
   *
   * The event is emitted here rather than in `UsersService.create` so the
   * seed script, which calls `create` directly, doesn't send welcome emails.
   */
  async signup(dto: SignupDto): Promise<Pick<User, 'id' | 'email'>> {
    const user = await this.usersService.create(dto.email, dto.password);
    this.eventEmitter.emit(
      USER_CREATED,
      new UserCreatedEvent(user.id, user.email),
    );
    return { id: user.id, email: user.email };
  }

  /**
   * Verify an email/password pair against the stored bcrypt hash.
   * @returns the fields `login` needs if valid, `null` otherwise (Passport's
   *   local-strategy convention; `LocalStrategy` turns `null` into a 401).
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

  /**
   * Issue a session for a password-verified user. With 2FA enabled it
   * returns a short-lived `tempToken` instead of an `access_token`, so the
   * password alone is never enough; `authenticateTwoFactor` exchanges it
   * (plus a TOTP code) for the real token.
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

    // JwtStrategy trusts the payload without a DB lookup, so anything a
    // guard checks (like role) must be signed in here.
    const payload = { sub: user.id, email: user.email, role: user.role };
    return { access_token: this.jwtService.sign(payload) };
  }

  /**
   * Generate a new TOTP secret and return it as a QR code data URL.
   * Calling this again before `turnOnTwoFactor` overwrites the previous
   * secret, so only the latest QR code is valid.
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
   * Enable 2FA once a code from the authenticator app proves the QR code
   * was scanned correctly. The code is spent, so it can't be replayed to
   * log in moments later.
   * @throws BadRequestException if no secret was generated yet, or the
   *   code doesn't match or was already used.
   */
  async turnOnTwoFactor(userId: number, code: string): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (!user?.twoFactorSecret) {
      throw new BadRequestException(
        'No two-factor secret has been generated for this account yet',
      );
    }

    await this.verifyAndSpendCode(userId, user.twoFactorSecret, code);
    await this.usersService.enableTwoFactor(userId);
  }

  /**
   * Exchange a `tempToken` from `login` plus a TOTP code for a real
   * `access_token`. The caller has no real token yet, so `tempToken` is
   * verified here rather than by a guard.
   * @throws UnauthorizedException if `tempToken` is missing, expired, or
   *   isn't actually a pending-2FA token.
   * @throws BadRequestException if `code` doesn't match the user's secret,
   *   or was already used.
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

    await this.verifyAndSpendCode(user.id, user.twoFactorSecret, code);

    return {
      access_token: this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
    };
  }

  /**
   * Check a TOTP code and spend its time step, so it can never be accepted
   * again. `checkDelta` (unlike `check`) reports which step matched, which
   * is what gets recorded.
   * @throws BadRequestException if the code doesn't match, or its step (or
   *   a later one) was already spent. The reused-code message is distinct
   *   because it helps a real user and tells an attacker nothing new.
   */
  private async verifyAndSpendCode(
    userId: number,
    secret: string,
    code: string,
  ): Promise<void> {
    const delta = authenticator.checkDelta(code, secret);

    if (delta === null) {
      throw new BadRequestException('Invalid two-factor code');
    }

    const step = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS) + delta;
    const spent = await this.usersService.consumeTotpStep(userId, step);

    if (!spent) {
      throw new BadRequestException(
        'This two-factor code has already been used — wait for the next one',
      );
    }
  }
}
