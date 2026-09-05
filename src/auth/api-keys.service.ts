import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKey } from './entities/api-key.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeysRepository: Repository<ApiKey>,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Mint a new key for `userId`. The raw key is returned here and never
   * again — only its SHA-256 hash is stored, so this is the one moment it
   * exists anywhere other than the caller's hands.
   */
  async generate(
    userId: number,
    label?: string,
  ): Promise<{ id: number; apiKey: string }> {
    const rawKey = crypto.randomBytes(32).toString('hex');
    const apiKey = this.apiKeysRepository.create({
      userId,
      hashedKey: sha256(rawKey),
      label: label ?? null,
      lastUsedAt: null,
    });
    const saved = await this.apiKeysRepository.save(apiKey);
    return { id: saved.id, apiKey: rawKey };
  }

  /** List `userId`'s own keys — metadata only, the hash never leaves here. */
  async listForUser(
    userId: number,
  ): Promise<Pick<ApiKey, 'id' | 'label' | 'createdAt' | 'lastUsedAt'>[]> {
    const keys = await this.apiKeysRepository.find({ where: { userId } });
    return keys.map(({ id, label, createdAt, lastUsedAt }) => ({
      id,
      label,
      createdAt,
      lastUsedAt,
    }));
  }

  /**
   * Delete a key, but only if it belongs to `userId`.
   * @throws NotFoundException if the id doesn't exist, or belongs to
   *   someone else — both cases look identical to the caller on purpose,
   *   so a revoke attempt can't be used to probe which ids exist.
   */
  async revoke(userId: number, keyId: number): Promise<void> {
    const key = await this.apiKeysRepository.findOneBy({ id: keyId });

    if (!key || key.userId !== userId) {
      throw new NotFoundException('API key not found');
    }

    await this.apiKeysRepository.delete(keyId);
  }

  /**
   * Resolve a raw key (as sent on the `x-api-key` header) to its owning
   * user, or `null` if it doesn't match any stored key.
   */
  async validateKey(rawKey: string): Promise<User | null> {
    const key = await this.apiKeysRepository.findOneBy({
      hashedKey: sha256(rawKey),
    });

    if (!key) {
      return null;
    }

    await this.apiKeysRepository.update(key.id, { lastUsedAt: new Date() });
    return this.usersService.findById(key.userId);
  }
}
