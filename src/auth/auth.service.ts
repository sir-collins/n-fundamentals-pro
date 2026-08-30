import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Register a new user.
   *
   * `UsersService.create` returns the full `User` entity, hash included —
   * that's the right internal shape (e.g. login will need the hash to
   * compare against). This is the boundary where it's stripped, so a
   * password hash can never leak into an HTTP response from this path.
   *
   * Fields are picked explicitly rather than destructuring `password` off
   * and returning the rest — an omit-style rest spread would silently
   * start including any new field added to `User` later (a role, a phone
   * number) unless someone remembered to exclude it too.
   */
  async signup(dto: SignupDto): Promise<Omit<User, 'password'>> {
    const user = await this.usersService.create(dto.email, dto.password);
    return { id: user.id, email: user.email };
  }
}
