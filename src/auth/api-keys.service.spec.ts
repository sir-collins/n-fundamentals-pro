import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { ApiKeysService } from './api-keys.service';
import { ApiKey } from './entities/api-key.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

// Real `crypto` throughout — hashing is the behaviour under test, so the
// spec computes the expected SHA-256 itself instead of mocking it away.
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let repository: DeepMocked<Repository<ApiKey>>;
  let usersService: DeepMocked<UsersService>;

  beforeEach(() => {
    repository = createMock<Repository<ApiKey>>();
    usersService = createMock<UsersService>();
    // Awaited without reading the result — must be programmed, or the
    // createMock proxy's fake `then` would hang the test.
    repository.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });
    repository.delete.mockResolvedValue({ affected: 1, raw: [] });
    service = new ApiKeysService(repository, usersService);
  });

  describe('generate', () => {
    it('returns the raw key once and stores only its SHA-256 hash', async () => {
      repository.create.mockImplementation((key) => key as ApiKey);
      repository.save.mockImplementation((key) =>
        Promise.resolve({ ...key, id: 9 } as ApiKey),
      );

      const { id, apiKey } = await service.generate(1, 'ci');

      expect(id).toBe(9);
      expect(apiKey).toMatch(/^[0-9a-f]{64}$/);
      const stored = repository.save.mock.calls[0][0] as ApiKey;
      expect(stored.hashedKey).toBe(sha256(apiKey));
      expect(stored.hashedKey).not.toBe(apiKey);
      expect(stored).toMatchObject({ userId: 1, label: 'ci' });
    });
  });

  describe('validateKey', () => {
    it('finds the key by its hash, records the use, and returns the owner', async () => {
      const owner = { id: 1, email: 'ada@example.com' } as User;
      repository.findOneBy.mockResolvedValue({ id: 9, userId: 1 } as ApiKey);
      usersService.findById.mockResolvedValue(owner);

      expect(await service.validateKey('raw-key')).toBe(owner);
      expect(repository.findOneBy).toHaveBeenCalledWith({
        hashedKey: sha256('raw-key'),
      });
      expect(repository.update).toHaveBeenCalledWith(9, {
        lastUsedAt: expect.any(Date),
      });
      expect(usersService.findById).toHaveBeenCalledWith(1);
    });

    it('returns null for an unknown key without recording anything', async () => {
      repository.findOneBy.mockResolvedValue(null);

      expect(await service.validateKey('unknown')).toBeNull();
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it("deletes the caller's own key", async () => {
      repository.findOneBy.mockResolvedValue({ id: 9, userId: 1 } as ApiKey);

      await service.revoke(1, 9);

      expect(repository.delete).toHaveBeenCalledWith(9);
    });

    it("refuses someone else's key, exactly as if it didn't exist", async () => {
      repository.findOneBy.mockResolvedValue({ id: 9, userId: 2 } as ApiKey);

      await expect(service.revoke(1, 9)).rejects.toThrow(NotFoundException);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('refuses a key that does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.revoke(1, 404)).rejects.toThrow(NotFoundException);
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('listForUser', () => {
    it('returns metadata only — never the hash', async () => {
      const createdAt = new Date('2026-01-01');
      repository.find.mockResolvedValue([
        {
          id: 9,
          userId: 1,
          hashedKey: 'secret-hash',
          label: 'ci',
          createdAt,
          lastUsedAt: null,
        },
      ]);

      const keys = await service.listForUser(1);

      expect(keys).toEqual([
        { id: 9, label: 'ci', createdAt, lastUsedAt: null },
      ]);
      expect(keys[0]).not.toHaveProperty('hashedKey');
      expect(repository.find).toHaveBeenCalledWith({ where: { userId: 1 } });
    });
  });
});
