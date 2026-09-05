import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A long-lived credential for machine-to-machine access — the
 * non-Passport counterpart to a JWT session, for callers with no human
 * around to type a password (a script, a cron job, another service).
 *
 * `hashedKey` is a SHA-256 hex digest, not a bcrypt hash — deliberately.
 * The raw key is already high-entropy (32 random bytes), so there's
 * nothing for bcrypt's slowness to meaningfully defend against, and
 * bcrypt's per-call random salt would make a direct `WHERE hashedKey = ?`
 * lookup impossible (every row would need `bcrypt.compare()` against it
 * individually). SHA-256 is deterministic, so the same raw key always
 * hashes to the same value and a plain indexed lookup — `unique: true`
 * below doubles as that index — works.
 *
 * `userId` is a plain column, not a `@ManyToOne` relation — this project
 * hasn't needed a real TypeORM relation for a foreign key yet, so this
 * keeps the same simplicity level rather than introducing one early.
 */
@Entity()
export class ApiKey {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @Column({ unique: true })
  hashedKey!: string;

  // Caller-supplied metadata (e.g. "CI key") so a list of keys is
  // distinguishable when deciding which one to revoke — not required for
  // the mechanism to work.
  @Column({ type: 'varchar', nullable: true })
  label!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  // Set by ApiKeyGuard on every successful use. Not required for the
  // feature to work — just a realistic touch (mirrors what a GitHub/Stripe
  // key dashboard shows) that also happens to prove, during verification,
  // that the guard's lookup path actually ran.
  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt!: Date | null;
}
