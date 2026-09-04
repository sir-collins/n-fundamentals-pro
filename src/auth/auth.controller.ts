import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { TwoFactorCodeDto } from './dto/two-factor-code.dto';
import { TwoFactorAuthenticateDto } from './dto/two-factor-authenticate.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user.
   * @throws ConflictException if the email is already registered.
   */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDto): Promise<Pick<User, 'id' | 'email'>> {
    try {
      return await this.authService.signup(dto);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to sign up');
    }
  }

  /**
   * Log in with email + password. Returns a signed JWT directly, unless
   * the account has 2FA enabled — then it returns a short-lived
   * `tempToken` instead, and the client must complete
   * `POST /auth/2fa/authenticate` with a TOTP code to get a real token.
   *
   * `AuthGuard('local')` runs `LocalStrategy` before this body ever
   * executes — a bad credential pair 401s there, so the try/catch below
   * only covers unexpected failures inside `login()` itself.
   */
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Req()
    req: Request & {
      user: Pick<User, 'id' | 'email' | 'role' | 'isTwoFactorEnabled'>;
    },
  ): { access_token: string } | { twoFactorRequired: true; tempToken: string } {
    try {
      return this.authService.login(req.user);
    } catch {
      throw new InternalServerErrorException('Failed to log in');
    }
  }

  /**
   * The authenticated user's own identity. First route protected by a
   * JWT: `AuthGuard('jwt')` runs `JwtStrategy` before this body ever
   * executes — a missing, malformed, or expired token 401s there, so
   * nothing in this handler can actually throw.
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  profile(
    @Req()
    req: Request & { user: { id: number; email: string; role: UserRole } },
  ): { id: number; email: string; role: UserRole } {
    return req.user;
  }

  /**
   * Generate a new TOTP secret and return it as a scannable QR code data
   * URL. Requires a valid JWT — 2FA setup only makes sense for a caller
   * we already know the identity of.
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/generate')
  @HttpCode(HttpStatus.OK)
  async generateTwoFactor(
    @Req() req: Request & { user: { id: number; email: string } },
  ): Promise<{ qrCodeDataUrl: string }> {
    try {
      return await this.authService.generateTwoFactorSecret(
        req.user.id,
        req.user.email,
      );
    } catch {
      throw new InternalServerErrorException(
        'Failed to generate two-factor secret',
      );
    }
  }

  /**
   * Confirm 2FA setup with a code from the user's authenticator app.
   * @throws BadRequestException if the code doesn't match.
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/turn-on')
  @HttpCode(HttpStatus.OK)
  async turnOnTwoFactor(
    @Req() req: Request & { user: { id: number } },
    @Body() dto: TwoFactorCodeDto,
  ): Promise<{ message: string }> {
    try {
      await this.authService.turnOnTwoFactor(req.user.id, dto.code);
      return { message: 'Two-factor authentication enabled' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to turn on 2FA');
    }
  }

  /**
   * Second half of a 2FA login: exchange the `tempToken` from `login`
   * plus a TOTP code for a real `access_token`. Deliberately no
   * `@UseGuards` here — the caller doesn't have a real token yet, so
   * `tempToken` is what's checked (manually, inside the service), not an
   * `Authorization` header.
   * @throws UnauthorizedException if `tempToken` is invalid/expired.
   * @throws BadRequestException if `code` doesn't match.
   */
  @Post('2fa/authenticate')
  @HttpCode(HttpStatus.OK)
  async authenticateTwoFactor(
    @Body() dto: TwoFactorAuthenticateDto,
  ): Promise<{ access_token: string }> {
    try {
      return await this.authService.authenticateTwoFactor(
        dto.tempToken,
        dto.code,
      );
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to authenticate with two-factor code',
      );
    }
  }
}
