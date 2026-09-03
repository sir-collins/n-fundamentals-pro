import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
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
   * Log in with email + password, returning a signed JWT.
   *
   * `AuthGuard('local')` runs `LocalStrategy` before this body ever
   * executes — a bad credential pair 401s there, so the try/catch below
   * only covers unexpected failures inside `login()` itself.
   */
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Req() req: Request & { user: Omit<User, 'password'> }): {
    access_token: string;
  } {
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
}
