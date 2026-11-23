import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A long-lived credential for machine-to-machine access (scripts, cron
 * jobs, other services).
 *
 * `hashedKey` is SHA-256, not bcrypt: the raw key is 32 random bytes, so
 * bcrypt's slowness adds nothing, and its random salt would rule out a
 * direct indexed `WHERE hashedKey = ?` lookup (`unique: true` provides the
 * index).
 *
 * `userId` is a plain column rather than a `@ManyToOne` relation, since
 * nothing needs to load the user through it.
 */
@Entity()
export class ApiKey {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @Column({ unique: true })
  hashedKey!: string;

  // Optional, so users can tell keys apart when revoking one.
  @Column({ type: 'varchar', nullable: true })
  label!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  // Updated on every successful key lookup (see ApiKeysService.validateKey).
  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt!: Date | null;
}
