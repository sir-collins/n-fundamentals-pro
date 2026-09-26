import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { UserRole } from '../users/entities/user.entity';

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let authService: DeepMocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        { provide: AuthService, useValue: createMock<AuthService>() },
      ],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
    authService = module.get(AuthService);
  });

  const credentials = { email: 'ada@example.com', password: 'password123' };
  const validatedUser = {
    id: 1,
    email: 'ada@example.com',
    role: UserRole.USER,
    isTwoFactorEnabled: false,
  };

  describe('signup', () => {
    it('returns the created user from the service', async () => {
      const created = { id: 1, email: 'ada@example.com' };
      authService.signup.mockResolvedValue(created);

      expect(await resolver.signup(credentials)).toBe(created);
      expect(authService.signup).toHaveBeenCalledWith(credentials);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException and never issues a token on bad credentials', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(resolver.login(credentials)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('validates the given credentials, then logs in that exact user', async () => {
      authService.validateUser.mockResolvedValue(validatedUser);
      authService.login.mockReturnValue({ access_token: 'jwt' });

      await resolver.login(credentials);

      expect(authService.validateUser).toHaveBeenCalledWith(
        credentials.email,
        credentials.password,
      );
      expect(authService.login).toHaveBeenCalledWith(validatedUser);
    });

    it('maps REST-style `access_token` onto GraphQL `accessToken`', async () => {
      authService.validateUser.mockResolvedValue(validatedUser);
      authService.login.mockReturnValue({ access_token: 'jwt' });

      expect(await resolver.login(credentials)).toEqual({
        accessToken: 'jwt',
      });
    });

    it('passes a 2FA challenge through without an `accessToken`', async () => {
      authService.validateUser.mockResolvedValue({
        ...validatedUser,
        isTwoFactorEnabled: true,
      });
      authService.login.mockReturnValue({
        twoFactorRequired: true,
        tempToken: 'temp',
      });

      expect(await resolver.login(credentials)).toEqual({
        twoFactorRequired: true,
        tempToken: 'temp',
      });
    });
  });

  describe('profile', () => {
    it('returns the user the guard attached to the request', () => {
      const user = { id: 1, email: 'ada@example.com', role: UserRole.USER };

      expect(resolver.profile({ req: { user } })).toBe(user);
    });
  });
});
