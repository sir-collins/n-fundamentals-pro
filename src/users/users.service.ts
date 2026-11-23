import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Or, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';

// bcrypt cost factor: 10 is the common default balancing brute-force
// resistance against signup/login latency.
const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Create a user with a bcrypt-hashed password.
   * @throws ConflictException if `email` is already registered.
   */
  async create(email: string, password: string): Promise<User> {
    const existing = await this.usersRepository.findOneBy({ email });

    if (existing) {
      throw new ConflictException(`A user with email ${email} already exists`);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    // No role parameter on purpose, so client input can never grant 'admin'.
    const user = this.usersRepository.create({
      email,
      password: hashedPassword,
      role: UserRole.USER,
    });
    return this.usersRepository.save(user);
  }

  /** Look up a user by email, or `null` if none exists. */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  /** Look up a user by id, or `null` if none exists. */
  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  /** Store a newly-generated TOTP secret for a user. */
  async setTwoFactorSecret(id: number, secret: string): Promise<void> {
    await this.usersRepository.update(id, { twoFactorSecret: secret });
  }

  /** Mark 2FA as active, once the user has confirmed their setup. */
  async enableTwoFactor(id: number): Promise<void> {
    await this.usersRepository.update(id, { isTwoFactorEnabled: true });
  }

  /**
   * Record `step` as the user's last-used TOTP step, only if it's strictly
   * later than the one spent before.
   *
   * One conditional UPDATE rather than read-compare-save: with
   * read-then-save, two requests carrying the same code could both read the
   * old value and both succeed. Postgres lets only one concurrent UPDATE
   * match this WHERE.
   * @returns `true` if the step was recorded (the code may be accepted),
   *   `false` if it — or a later one — was already spent.
   */
  async consumeTotpStep(id: number, step: number): Promise<boolean> {
    const result = await this.usersRepository.update(
      { id, lastTotpStep: Or(IsNull(), LessThan(step)) },
      { lastTotpStep: step },
    );
    return result.affected === 1;
  }

  /**
   * Point a user's avatar at a newly stored file.
   *
   * Reads the old filename and writes the new one in one transaction,
   * with the row locked (`FOR UPDATE`), so two uploads racing for the same
   * user can't both read the same old file and leave one new file behind
   * with nothing pointing at it.
   * @returns the previous filename (so the caller can delete that file),
   *   or `null` if no user exists with `id`.
   */
  async setAvatarPath(
    id: number,
    filename: string,
  ): Promise<{ previous: string | null } | null> {
    return this.usersRepository.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        return null;
      }

      await manager.update(User, id, { avatarPath: filename });
      return { previous: user.avatarPath };
    });
  }
}
