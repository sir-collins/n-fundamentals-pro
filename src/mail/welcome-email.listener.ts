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
 * `async: true` starts this on a later tick instead of inside `emit()`.
 * Awaited I/O wouldn't delay signup anyway (`emit()` doesn't wait for the
 * returned promise); what this guards against is *blocking* work in a
 * listener, measured at 3.1s vs 0.12s for a signup with a 3s busy loop.
 *
 * No try/catch here on purpose: `@nestjs/event-emitter` wraps every
 * listener and, with its default `suppressErrors: true`, logs a thrown
 * error instead of rethrowing it. Don't turn that off: with
 * `suppressErrors: false` the rejection goes unhandled, and signup still
 * returns 201 but the whole process exits a moment later.
 */
@Injectable()
export class WelcomeEmailListener {
  constructor(private readonly mailService: MailService) {}

  @OnEvent(USER_CREATED, { async: true })
  async handleUserCreated(event: UserCreatedEvent): Promise<void> {
    await this.mailService.sendWelcomeEmail(event.email);
  }
}
