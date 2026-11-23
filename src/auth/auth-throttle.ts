import { Throttle } from '@nestjs/throttler';

/** Attempts per client IP per minute on routes that check a secret. */
export const AUTH_ATTEMPTS_PER_MINUTE = 5;

/**
 * A strict limit for routes that check a password or a TOTP code, where
 * unlimited attempts would allow brute force (a 6-digit code has only a
 * million values).
 */
export const AuthThrottle = () =>
  Throttle({ default: { limit: AUTH_ATTEMPTS_PER_MINUTE, ttl: 60_000 } });
