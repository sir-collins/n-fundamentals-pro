import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
