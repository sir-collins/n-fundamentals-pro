import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
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
import { User } from '../users/entities/user.entity';
import type { AuthUser } from './auth-user';
import { CurrentUser } from './decorators/current-user.decorator';

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
    return this.authService.signup(dto);
  }

  /**
   * Log in with email + password. Returns a JWT, or a short-lived
   * `tempToken` if the account has 2FA enabled (complete it via
   * `POST /auth/2fa/authenticate`).
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
    // Uses @Req() rather than @CurrentUser(): LocalStrategy's user also
    // carries isTwoFactorEnabled, so it isn't an AuthUser.
    @Req()
    req: Request & {
      user: Pick<User, 'id' | 'email' | 'role' | 'isTwoFactorEnabled'>;
    },
  ): { access_token: string } | { twoFactorRequired: true; tempToken: string } {
    return this.authService.login(req.user);
  }

  /** The authenticated user's own identity, read from the JWT. */
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
  profile(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  /** Generate a new TOTP secret, returned as a QR code data URL. */
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
    @CurrentUser() user: AuthUser,
  ): Promise<{ qrCodeDataUrl: string }> {
    return await this.authService.generateTwoFactorSecret(user.id, user.email);
  }

  /**
   * Confirm 2FA setup with a code from the user's authenticator app.
   * @throws BadRequestException if the code doesn't match or was already used.
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
    @CurrentUser('id') userId: number,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<{ message: string }> {
    await this.authService.turnOnTwoFactor(userId, dto.code);
    return { message: 'Two-factor authentication enabled' };
  }

  /**
   * Second half of a 2FA login: exchange the `tempToken` from `login` plus
   * a TOTP code for a real `access_token`. Unguarded on purpose: the caller
   * has no real token yet, and the service verifies `tempToken` itself.
   * @throws UnauthorizedException if `tempToken` is invalid/expired.
   * @throws BadRequestException if `code` doesn't match or was already used.
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
    return await this.authService.authenticateTwoFactor(
      dto.tempToken,
      dto.code,
    );
  }

  /**
   * Mint a new API key for the caller. Requires a JWT, not an API key, so a
   * leaked key can't mint replacements for itself. The raw key is returned
   * only here; just its hash is stored.
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
    @CurrentUser('id') userId: number,
    @Body() dto: CreateApiKeyDto,
  ): Promise<{ id: number; apiKey: string }> {
    return this.apiKeysService.generate(userId, dto.label);
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
    @CurrentUser('id') userId: number,
  ): Promise<Pick<ApiKey, 'id' | 'label' | 'createdAt' | 'lastUsedAt'>[]> {
    return this.apiKeysService.listForUser(userId);
  }

  /**
   * Identify the caller by API key alone. Same response shape as
   * `GET /auth/profile`.
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
  whoami(@CurrentUser() user: AuthUser): AuthUser {
    return user;
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
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.apiKeysService.revoke(userId, id);
    return { message: 'API key revoked' };
  }
}
