import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

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
    const user = this.usersRepository.create({
      email,
      password: hashedPassword,
    });
    return this.usersRepository.save(user);
  }

  /** Look up a user by email, or `null` if none exists. */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }
}
