/** Event name for `UserCreatedEvent`, shared by the emitter and listeners. */
export const USER_CREATED = 'user.created';

/**
 * Emitted by `AuthService.signup` once a new account exists. Deliberately
 * minimal (no password hash, no full entity): listeners get the facts
 * they need, and anything else they can look up themselves.
 */
export class UserCreatedEvent {
  constructor(
    readonly userId: number,
    readonly email: string,
  ) {}
}
