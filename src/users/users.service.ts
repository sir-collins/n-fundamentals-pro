import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Or, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';

// bcrypt's cost factor — how many rounds of hashing it does. Higher is
// slower (both for an attacker brute-forcing guesses, and for us on every
// signup/login), 10 is a common default that keeps that trade-off sane.
const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Create a user, hashing `password` before it ever touches the
   * database.
   * @throws ConflictException if `email` is already registered.
   */
  async create(email: string, password: string): Promise<User> {
    const existing = await this.usersRepository.findOneBy({ email });

    if (existing) {
      throw new ConflictException(`A user with email ${email} already exists`);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    // Deliberately no role parameter on this method — every user created
    // through signup is 'user', full stop. Nothing here can hand out
    // 'admin' from client input.
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
   * Spend a TOTP step for a user: record `step` as their last-used one,
   * but only if it's strictly later than whatever was spent before.
   *
   * Deliberately one conditional UPDATE, not "read lastTotpStep, compare,
   * then save" — with read-then-save, two requests carrying the same code
   * can both read the old value before either writes, and both succeed.
   * Postgres lets only one of two concurrent UPDATEs match this WHERE.
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
}
