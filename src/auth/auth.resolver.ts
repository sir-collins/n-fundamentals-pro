import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResult } from './dto/login-result.type';
import { SignupResult } from './dto/signup-result.type';
import { User } from '../users/entities/user.entity';
import type { AuthUser } from './auth-user';
import { AuthThrottle } from './auth-throttle';
import { CurrentUser } from './decorators/current-user.decorator';

/**
 * GraphQL signup/login/profile, backed by the same `AuthService` as REST.
 * 2FA and API key management are REST-only.
 */
@Resolver(() => User)
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => SignupResult)
  signup(@Args('input') input: SignupDto): Promise<SignupResult> {
    return this.authService.signup(input);
  }

  /**
   * Calls `validateUser` directly instead of using `LocalStrategy`, which
   * reads credentials from the request body and doesn't map onto GraphQL
   * args. Throws the same error `LocalStrategy` would.
   * @throws UnauthorizedException if the credentials don't match a user.
   */
  @AuthThrottle()
  @Mutation(() => LoginResult)
  async login(@Args('input') input: LoginDto): Promise<LoginResult> {
    const user = await this.authService.validateUser(
      input.email,
      input.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const result = this.authService.login(user);

    return 'access_token' in result
      ? { accessToken: result.access_token }
      : { twoFactorRequired: true, tempToken: result.tempToken };
  }

  /** The authenticated user's own identity; mirrors `GET /auth/profile`. */
  @UseGuards(GqlAuthGuard)
  @Query(() => User)
  profile(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
