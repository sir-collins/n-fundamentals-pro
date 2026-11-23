import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

registerEnumType(UserRole, { name: 'UserRole' });

/**
 * A registered user. `password` holds a bcrypt hash.
 *
 * Only `id`, `email` and `role` have `@Field()`. Every other column is left
 * undecorated, so it doesn't exist in the GraphQL schema and can't leak
 * through it.
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

  // Safety net for rows inserted outside UsersService.create, which never
  // accepts a role.
  @Field(() => UserRole)
  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  // Stored in plain text, a known gap: production should encrypt it at
  // rest. `null` until POST /auth/2fa/generate.
  //
  // `type` is explicit because `string | null` reflects as `Object` at
  // runtime, which TypeORM can't map to a column type.
  @Column({ type: 'varchar', nullable: true })
  twoFactorSecret!: string | null;

  @Column({ default: false })
  isTwoFactorEnabled!: boolean;

  // TOTP step (Unix seconds / 30) of the last code this user spent. Replay
  // protection: a code is accepted only if its step is strictly later.
  @Column({ type: 'integer', nullable: true })
  lastTotpStep!: number | null;

  // Server-generated filename inside `<UPLOADS_DIR>/avatars`, never the
  // client's. Avatars are REST-only.
  @Column({ type: 'varchar', nullable: true })
  avatarPath!: string | null;
}
