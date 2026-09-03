import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

/**
 * A registered user. `password` holds a bcrypt hash, never the plaintext
 * — see `UsersService.create` for where that hashing happens, and
 * `AuthService` for where the hash is stripped before crossing the HTTP
 * boundary.
 */
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  // Default here is a safety net for any row inserted outside
  // UsersService.create — the real control point is that `create` never
  // accepts a role parameter at all, so nothing can hand out 'admin' via
  // signup.
  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;
}
