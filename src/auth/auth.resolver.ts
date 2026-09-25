import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResult } from './dto/login-result.type';
import { SignupResult } from './dto/signup-result.type';
import { User } from '../users/entities/user.entity';

/**
 * GraphQL layer for `auth` — scoped tightly to signup/login/profile,
 * reusing the exact same `AuthService` `AuthController` already uses.
 * 2FA and API keys deliberately stay REST-only; not named by this
 * roadmap step, and out of proportion to add here.
 */
@Resolver(() => User)
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => SignupResult)
  signup(@Args('input') input: SignupDto): Promise<SignupResult> {
    return this.authService.signup(input);
  }

  /**
   * Unlike REST's `login()`, this doesn't go through
   * `AuthGuard('local')`/`LocalStrategy` — Passport's local strategy
   * reads credentials off the request body by convention, which doesn't
   * map cleanly onto GraphQL args. `validateUser` is called directly
   * instead, throwing exactly what `LocalStrategy.validate` already
   * would on a bad credential pair.
   * @throws UnauthorizedException if the credentials don't match a user.
   */
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

  /** The authenticated user's own identity — GraphQL's `GET /auth/profile`. */
  @UseGuards(GqlAuthGuard)
  @Query(() => User)
  profile(
    @Context() context: { req: { user: Pick<User, 'id' | 'email' | 'role'> } },
  ): Pick<User, 'id' | 'email' | 'role'> {
    return context.req.user;
  }
}
