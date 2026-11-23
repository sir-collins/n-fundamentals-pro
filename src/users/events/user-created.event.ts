/** Event name for `UserCreatedEvent`, shared by the emitter and listeners. */
export const USER_CREATED = 'user.created';

/**
 * Emitted by `AuthService.signup`. Carries only ids and email, never the
 * entity, so the password hash can't reach a listener.
 */
export class UserCreatedEvent {
  constructor(
    readonly userId: number,
    readonly email: string,
  ) {}
}
