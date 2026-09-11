import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { TwoFactorCodeDto } from './dto/two-factor-code.dto';
import { TwoFactorAuthenticateDto } from './dto/two-factor-authenticate.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKey } from './entities/api-key.entity';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly apiKeysService: ApiKeysService,
  ) {}

  /**
   * Register a new user.
   * @throws ConflictException if the email is already registered.
   */
  @ApiOperation({ summary: 'Register a new user.' })
  @ApiResponse({
    status: 201,
    description: 'User created.',
    schema: { example: { id: 1, email: 'user@example.com' } },
  })
  @ApiResponse({ status: 409, description: 'Email already registered.' })
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
  @ApiBody({ type: LoginDto })
  @ApiOperation({
    summary:
      'Log in with email + password. Returns a JWT directly, unless the ' +
      'account has 2FA enabled — then it returns a short-lived tempToken ' +
      'instead; complete POST /auth/2fa/authenticate with a TOTP code to ' +
      'get a real token.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Either { access_token } (2FA disabled) or ' +
      '{ twoFactorRequired: true, tempToken } (2FA enabled).',
    schema: { example: { access_token: 'eyJhbGciOi...' } },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: "The authenticated user's own identity." })
  @ApiResponse({
    status: 200,
    description: 'The caller.',
    schema: { example: { id: 1, email: 'user@example.com', role: 'user' } },
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate a new TOTP secret, returned as a scannable QR code.',
  })
  @ApiResponse({
    status: 200,
    description: 'QR code for an authenticator app to scan.',
    schema: { example: { qrCodeDataUrl: 'data:image/png;base64,...' } },
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Confirm 2FA setup with a code from the user's authenticator app.",
  })
  @ApiResponse({
    status: 200,
    description: 'Two-factor authentication enabled.',
  })
  @ApiResponse({ status: 400, description: "Code doesn't match." })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
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
  @ApiOperation({
    summary:
      'Second half of a 2FA login: exchange the tempToken from login plus ' +
      'a TOTP code for a real access_token. No auth header here — the ' +
      'tempToken itself is what proves the password check already passed.',
  })
  @ApiResponse({
    status: 200,
    description: 'A real access_token.',
    schema: { example: { access_token: 'eyJhbGciOi...' } },
  })
  @ApiResponse({
    status: 401,
    description: 'tempToken invalid/expired.',
  })
  @ApiResponse({ status: 400, description: "code doesn't match." })
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

  /**
   * Mint a new API key for the caller. Guarded by `AuthGuard('jwt')`, not
   * `ApiKeyGuard` — deliberately: minting a key must require a real login
   * session, or a single leaked key could mint unlimited replacements for
   * itself. The raw key is only ever returned here — only its hash is
   * stored, so losing this response means generating a new key, not
   * recovering the old one.
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Mint a new API key for the caller. Shown exactly once — only its ' +
      'hash is stored.',
  })
  @ApiResponse({
    status: 201,
    description: 'The new key. This is the only time the raw value is shown.',
    schema: { example: { id: 1, apiKey: 'raw-key-shown-once...' } },
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
  @UseGuards(AuthGuard('jwt'))
  @Post('api-keys')
  @HttpCode(HttpStatus.CREATED)
  async createApiKey(
    @Req() req: Request & { user: { id: number } },
    @Body() dto: CreateApiKeyDto,
  ): Promise<{ id: number; apiKey: string }> {
    try {
      return await this.apiKeysService.generate(req.user.id, dto.label);
    } catch {
      throw new InternalServerErrorException('Failed to create API key');
    }
  }

  /** List the caller's own API keys — metadata only, never the raw key or hash. */
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "List the caller's own API keys — metadata only, never the raw key or hash.",
  })
  @ApiResponse({ status: 200, description: "The caller's API keys." })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
  @UseGuards(AuthGuard('jwt'))
  @Get('api-keys')
  async listApiKeys(
    @Req() req: Request & { user: { id: number } },
  ): Promise<Pick<ApiKey, 'id' | 'label' | 'createdAt' | 'lastUsedAt'>[]> {
    try {
      return await this.apiKeysService.listForUser(req.user.id);
    } catch {
      throw new InternalServerErrorException('Failed to list API keys');
    }
  }

  /**
   * Identify the caller by API key alone — `ApiKeyGuard` only, no JWT
   * involved. Deliberately the same response shape as `GET /auth/profile`:
   * same identity, different auth mechanism proving it.
   */
  @ApiSecurity('api-key')
  @ApiOperation({
    summary:
      'Identify the caller by API key alone — same shape as GET /auth/profile.',
  })
  @ApiResponse({
    status: 200,
    description: 'The caller.',
    schema: { example: { id: 1, email: 'user@example.com', role: 'user' } },
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid API key.' })
  @UseGuards(ApiKeyGuard)
  @Get('api-keys/whoami')
  whoami(
    @Req()
    req: Request & { user: { id: number; email: string; role: UserRole } },
  ): { id: number; email: string; role: UserRole } {
    return req.user;
  }

  /**
   * Revoke one of the caller's own API keys.
   * @throws NotFoundException if the id doesn't exist, or belongs to
   *   someone else — `ApiKeysService.revoke` treats both cases alike.
   */
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke one of the caller's own API keys." })
  @ApiResponse({ status: 200, description: 'API key revoked.' })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
  @ApiResponse({
    status: 404,
    description: "Id doesn't exist, or belongs to someone else.",
  })
  @UseGuards(AuthGuard('jwt'))
  @Delete('api-keys/:id')
  @HttpCode(HttpStatus.OK)
  async revokeApiKey(
    @Req() req: Request & { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    try {
      await this.apiKeysService.revoke(req.user.id, id);
      return { message: 'API key revoked' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to revoke API key');
    }
  }
}
