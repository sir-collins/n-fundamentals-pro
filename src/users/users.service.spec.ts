import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { IsNull, LessThan, Or, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';

// `bcrypt` is imported directly by UsersService, not injected, so DI
// (createMock) can't replace it — jest.mock swaps the whole module.
// Automatic: every exported function becomes a jest.fn() returning
// undefined, which each test then programs as needed.
jest.mock('bcrypt');

const hashMock = bcrypt.hash as unknown as jest.MockedFunction<
  (data: string, saltRounds: number) => Promise<string>
>;

describe('UsersService', () => {
  let service: UsersService;
  let repository: DeepMocked<Repository<User>>;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = createMock<Repository<User>>();
    service = new UsersService(repository);
  });

  describe('create', () => {
    it('stores the bcrypt hash, never the plain password, as a USER', async () => {
      repository.findOneBy.mockResolvedValue(null);
      hashMock.mockResolvedValue('$2b$10$hashed');
      repository.create.mockImplementation((user) => user as User);
      repository.save.mockImplementation((user) =>
        Promise.resolve({ id: 1, ...user } as User),
      );

      await service.create('ada@example.com', 'password123');

      expect(hashMock).toHaveBeenCalledWith('password123', 10);
      expect(repository.save).toHaveBeenCalledWith({
        email: 'ada@example.com',
        password: '$2b$10$hashed',
        role: UserRole.USER,
      });
    });

    it('rejects a taken email without hashing or saving anything', async () => {
      repository.findOneBy.mockResolvedValue({ id: 1 } as User);

      await expect(
        service.create('ada@example.com', 'password123'),
      ).rejects.toThrow(ConflictException);
      expect(hashMock).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('consumeTotpStep', () => {
    it('updates only if the step is later than the last spent one', async () => {
      repository.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

      expect(await service.consumeTotpStep(1, 100)).toBe(true);
      // One conditional UPDATE — the guard lives in the WHERE, so Postgres
      // (not a read-then-compare here) decides who wins a race.
      expect(repository.update).toHaveBeenCalledWith(
        { id: 1, lastTotpStep: Or(IsNull(), LessThan(100)) },
        { lastTotpStep: 100 },
      );
    });

    it('reports false when no row matched — the step was already spent', async () => {
      repository.update.mockResolvedValue({
        affected: 0,
        raw: [],
        generatedMaps: [],
      });

      expect(await service.consumeTotpStep(1, 100)).toBe(false);
    });
  });
  describe('setAvatarPath', () => {
    // The transaction's manager, standing in for the real one.
    function withManager(existing: Partial<User> | null) {
      const manager = {
        findOne: jest
          .fn<(...args: unknown[]) => Promise<Partial<User> | null>>()
          .mockResolvedValue(existing),
        update: jest
          .fn<(...args: unknown[]) => Promise<{ affected: number }>>()
          .mockResolvedValue({ affected: 1 }),
      };
      Object.assign(repository, {
        manager: {
          transaction: (work: (m: typeof manager) => Promise<unknown>) =>
            work(manager),
        },
      });
      return manager;
    }

    it('locks the row, stores the new filename, returns the old one', async () => {
      const manager = withManager({ id: 1, avatarPath: '1-old.png' });

      expect(await service.setAvatarPath(1, '1-new.png')).toEqual({
        previous: '1-old.png',
      });
      expect(manager.findOne).toHaveBeenCalledWith(User, {
        where: { id: 1 },
        lock: { mode: 'pessimistic_write' },
      });
      expect(manager.update).toHaveBeenCalledWith(User, 1, {
        avatarPath: '1-new.png',
      });
    });

    it('returns null and writes nothing for a missing user', async () => {
      const manager = withManager(null);

      expect(await service.setAvatarPath(1, '1-new.png')).toBeNull();
      expect(manager.update).not.toHaveBeenCalled();
    });
  });
});
