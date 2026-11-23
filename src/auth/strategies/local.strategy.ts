import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { User } from '../../users/entities/user.entity';

/**
 * Email/password strategy behind `POST /auth/login`. `usernameField` is
 * overridden because passport-local expects `username` by default.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  /** @throws UnauthorizedException if the credentials don't match a user. */
  async validate(
    email: string,
    password: string,
  ): Promise<Pick<User, 'id' | 'email' | 'role' | 'isTwoFactorEnabled'>> {
    const user = await this.authService.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }
}
