import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

// Registers the enum as a real GraphQL type (name shows up in the schema
// as `UserRole`) — without this, `@Field(() => UserRole)` below has no
// schema representation to point at.
registerEnumType(UserRole, { name: 'UserRole' });

/**
 * A registered user. `password` holds a bcrypt hash, never the plaintext
 * — see `UsersService.create` for where that hashing happens, and
 * `AuthService` for where the hash is stripped before crossing the HTTP
 * boundary.
 *
 * `@ObjectType()` only decorates `id`/`email`/`role` with `@Field()` —
 * `password`/`twoFactorSecret`/`isTwoFactorEnabled` are deliberately left
 * undecorated. Unlike a REST DTO (where leaving a field out means
 * remembering to omit it every time), an undecorated field simply has no
 * corresponding entry in the generated GraphQL schema at all — a
 * structural guarantee these can never leak via GraphQL, not a
 * "we were careful" one.
 */
@ObjectType()
@Entity()
export class User {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id!: number;

  @Field()
  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  // Default here is a safety net for any row inserted outside
  // UsersService.create — the real control point is that `create` never
  // accepts a role parameter at all, so nothing can hand out 'admin' via
  // signup.
  @Field(() => UserRole)
  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  // Plain text for now — a known, deliberate gap (same treatment as the
  // hardcoded JWT secret): a real production system would encrypt this at
  // rest. `null` until the user has generated a secret via
  // POST /auth/2fa/generate.
  //
  // type: 'varchar' is explicit here, not inferred — TypeScript's
  // `string | null` union reflects as just "Object" at runtime, which
  // TypeORM can't map to a Postgres column type on its own.
  @Column({ type: 'varchar', nullable: true })
  twoFactorSecret!: string | null;

  @Column({ default: false })
  isTwoFactorEnabled!: boolean;
}
