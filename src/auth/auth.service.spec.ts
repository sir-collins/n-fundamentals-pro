import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as qrcode from 'qrcode';
import { authenticator } from 'otplib';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/entities/user.entity';

// Libraries AuthService imports directly — DI can't swap these, so the
// modules themselves are replaced. bcrypt/qrcode export plain functions,
// so Jest's automatic mock is enough. `authenticator` is a class instance;
// an explicit factory keeps exactly what's being faked visible.
jest.mock('bcrypt');
jest.mock('qrcode');
jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: jest.fn(),
    keyuri: jest.fn(),
    checkDelta: jest.fn(),
  },
}));

const compareMock = bcrypt.compare as unknown as jest.MockedFunction<
  (data: string, encrypted: string) => Promise<boolean>
>;
const toDataUrlMock = qrcode.toDataURL as unknown as jest.MockedFunction<
  (text: string) => Promise<string>
>;
const otp = authenticator as unknown as {
  generateSecret: jest.MockedFunction<() => string>;
  keyuri: jest.MockedFunction<() => string>;
  checkDelta: jest.MockedFunction<
    (code: string, secret: string) => number | null
  >;
  options: unknown;
};

// A fixed clock for the 2FA tests, so the TOTP step AuthService records is
// predictable: 1_791_582_000 s / 30 = step 59_719_400 exactly.
const NOW_MS = 1_791_582_000_000;
const NOW_STEP = 59_719_400;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: DeepMocked<UsersService>;
  // Real, not mocked: signing/verifying is in-memory with no I/O, and a
  // real one lets tests decode issued tokens and forge expired or
  // wrong-kind ones — the things that actually matter for auth.
  const jwtService = new JwtService({ secret: 'test-secret' });

  const user = {
    id: 1,
    email: 'ada@example.com',
    password: '$2b$10$hashed',
    role: UserRole.USER,
    isTwoFactorEnabled: false,
    twoFactorSecret: null,
  } as unknown as User;

  beforeEach(() => {
    jest.clearAllMocks();
    usersService = createMock<UsersService>();
    // createMock gotcha: an async method left unprogrammed returns a
    // nested mock proxy whose `then` is itself a mock — so awaiting it
    // never settles and the test hangs until Jest's timeout. Every async
    // method AuthService awaits without reading a value gets an explicit
    // resolved value here.
    usersService.setTwoFactorSecret.mockResolvedValue(undefined);
    usersService.enableTwoFactor.mockResolvedValue(undefined);
    // Default: the step hasn't been spent yet. Replay tests override it.
    usersService.consumeTotpStep.mockResolvedValue(true);
    service = new AuthService(usersService, jwtService);
  });

  describe('signup', () => {
    it('returns only id and email, never the hash or role', async () => {
      usersService.create.mockResolvedValue(user);

      expect(
        await service.signup({ email: user.email, password: 'password123' }),
      ).toEqual({ id: 1, email: 'ada@example.com' });
    });
  });

  describe('validateUser', () => {
    it('returns null for an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      expect(await service.validateUser('nobody@example.com', 'x')).toBeNull();
    });

    it('returns null for a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      compareMock.mockResolvedValue(false);

      expect(await service.validateUser(user.email, 'wrong')).toBeNull();
      expect(compareMock).toHaveBeenCalledWith('wrong', user.password);
    });

    it('returns only what login needs — no password hash', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      compareMock.mockResolvedValue(true);

      expect(await service.validateUser(user.email, 'password123')).toEqual({
        id: 1,
        email: 'ada@example.com',
        role: UserRole.USER,
        isTwoFactorEnabled: false,
      });
    });
  });

  describe('login', () => {
    it('issues an access token carrying id, email and role without 2FA', () => {
      const result = service.login(user);

      expect(result).toHaveProperty('access_token');
      const token = (result as { access_token: string }).access_token;
      expect(jwtService.verify(token)).toMatchObject({
        sub: 1,
        email: 'ada@example.com',
        role: UserRole.USER,
      });
    });

    it('withholds the access token when 2FA is on, issuing a 5-minute tempToken', () => {
      const result = service.login({ ...user, isTwoFactorEnabled: true });

      expect(result).not.toHaveProperty('access_token');
      expect(result).toMatchObject({ twoFactorRequired: true });
      const { tempToken } = result as { tempToken: string };
      const payload = jwtService.verify<{
        sub: number;
        twoFactorPending: boolean;
        iat: number;
        exp: number;
      }>(tempToken);
      expect(payload).toMatchObject({ sub: 1, twoFactorPending: true });
      expect(payload.exp - payload.iat).toBe(5 * 60);
    });
  });

  describe('generateTwoFactorSecret', () => {
    it('stores a new secret and returns it as a QR code', async () => {
      otp.generateSecret.mockReturnValue('SECRET');
      otp.keyuri.mockReturnValue('otpauth://totp/...');
      toDataUrlMock.mockResolvedValue('data:image/png;base64,QR');

      expect(await service.generateTwoFactorSecret(1, user.email)).toEqual({
        qrCodeDataUrl: 'data:image/png;base64,QR',
      });
      expect(usersService.setTwoFactorSecret).toHaveBeenCalledWith(1, 'SECRET');
    });
  });

  // Set once at import by auth.service.ts, on the (mocked) shared
  // authenticator — the replay protection is what makes this safe.
  it('accepts the previous TOTP step too (window: 1)', () => {
    expect(otp.options).toEqual({ window: 1 });
  });

  describe('turnOnTwoFactor', () => {
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('refuses when no secret has been generated', async () => {
      usersService.findById.mockResolvedValue(user);

      await expect(service.turnOnTwoFactor(1, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses a wrong code and leaves 2FA off', async () => {
      usersService.findById.mockResolvedValue({
        ...user,
        twoFactorSecret: 'SECRET',
      });
      otp.checkDelta.mockReturnValue(null);

      await expect(service.turnOnTwoFactor(1, '000000')).rejects.toThrow(
        BadRequestException,
      );
      expect(usersService.consumeTotpStep).not.toHaveBeenCalled();
      expect(usersService.enableTwoFactor).not.toHaveBeenCalled();
    });

    it('refuses an already-used code and leaves 2FA off', async () => {
      usersService.findById.mockResolvedValue({
        ...user,
        twoFactorSecret: 'SECRET',
      });
      otp.checkDelta.mockReturnValue(0);
      usersService.consumeTotpStep.mockResolvedValue(false);

      await expect(service.turnOnTwoFactor(1, '123456')).rejects.toThrow(
        'already been used',
      );
      expect(usersService.enableTwoFactor).not.toHaveBeenCalled();
    });

    it('enables 2FA once a correct code proves the secret was scanned', async () => {
      usersService.findById.mockResolvedValue({
        ...user,
        twoFactorSecret: 'SECRET',
      });
      otp.checkDelta.mockReturnValue(0);

      await service.turnOnTwoFactor(1, '123456');

      expect(otp.checkDelta).toHaveBeenCalledWith('123456', 'SECRET');
      // The setup code is spent too, so it can't be replayed at login.
      expect(usersService.consumeTotpStep).toHaveBeenCalledWith(1, NOW_STEP);
      expect(usersService.enableTwoFactor).toHaveBeenCalledWith(1);
    });
  });

  describe('authenticateTwoFactor', () => {
    const userWith2fa = {
      ...user,
      isTwoFactorEnabled: true,
      twoFactorSecret: 'SECRET',
    } as User;
    const pendingToken = () =>
      jwtService.sign({ sub: 1, twoFactorPending: true }, { expiresIn: '5m' });

    // Pinned for the whole block — JwtService reads Date.now too, so the
    // tokens stay consistent with the clock (the expired-token test
    // computes its `exp` from the same pinned value).
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('rejects a token that is not a valid JWT', async () => {
      await expect(
        service.authenticateTwoFactor('garbage', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired tempToken', async () => {
      const expired = jwtService.sign({
        sub: 1,
        twoFactorPending: true,
        exp: Math.floor(Date.now() / 1000) - 60,
      });

      await expect(
        service.authenticateTwoFactor(expired, '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a normal access token standing in for a tempToken', async () => {
      const accessToken = (service.login(user) as { access_token: string })
        .access_token;

      await expect(
        service.authenticateTwoFactor(accessToken, '123456'),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('rejects when the user has no 2FA secret', async () => {
      usersService.findById.mockResolvedValue(user);

      await expect(
        service.authenticateTwoFactor(pendingToken(), '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong code', async () => {
      usersService.findById.mockResolvedValue(userWith2fa);
      otp.checkDelta.mockReturnValue(null);

      await expect(
        service.authenticateTwoFactor(pendingToken(), '000000'),
      ).rejects.toThrow(BadRequestException);
      expect(usersService.consumeTotpStep).not.toHaveBeenCalled();
    });

    it('rejects a code whose step was already spent — no token issued', async () => {
      usersService.findById.mockResolvedValue(userWith2fa);
      otp.checkDelta.mockReturnValue(0);
      usersService.consumeTotpStep.mockResolvedValue(false);

      await expect(
        service.authenticateTwoFactor(pendingToken(), '123456'),
      ).rejects.toThrow('already been used');
    });

    it("records the previous step for a code from it (window: 1's delta -1)", async () => {
      usersService.findById.mockResolvedValue(userWith2fa);
      otp.checkDelta.mockReturnValue(-1);

      await service.authenticateTwoFactor(pendingToken(), '123456');

      expect(usersService.consumeTotpStep).toHaveBeenCalledWith(
        1,
        NOW_STEP - 1,
      );
    });

    it('exchanges a valid tempToken + code for a real access token', async () => {
      usersService.findById.mockResolvedValue(userWith2fa);
      otp.checkDelta.mockReturnValue(0);

      const { access_token } = await service.authenticateTwoFactor(
        pendingToken(),
        '123456',
      );

      expect(jwtService.verify(access_token)).toMatchObject({
        sub: 1,
        email: 'ada@example.com',
        role: UserRole.USER,
      });
      expect(otp.checkDelta).toHaveBeenCalledWith('123456', 'SECRET');
      expect(usersService.consumeTotpStep).toHaveBeenCalledWith(1, NOW_STEP);
    });
  });
});
