import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailService } from './mail.service';
import {
  USER_CREATED,
  UserCreatedEvent,
} from '../users/events/user-created.event';

/**
 * Sends the welcome email when a user signs up.
 *
 * `async: true` runs this on a later tick instead of inside `emit()`, so
 * synchronous (blocking) work here can't delay the signup response.
 *
 * No try/catch on purpose: with `@nestjs/event-emitter`'s default
 * `suppressErrors: true`, a thrown error is logged, not rethrown. Keep it
 * on: with `suppressErrors: false` the rejection goes unhandled and the
 * process exits right after signup returns 201.
 */
@Injectable()
export class WelcomeEmailListener {
  constructor(private readonly mailService: MailService) {}

  @OnEvent(USER_CREATED, { async: true })
  async handleUserCreated(event: UserCreatedEvent): Promise<void> {
    await this.mailService.sendWelcomeEmail(event.email);
  }
}
