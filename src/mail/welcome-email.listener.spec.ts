import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { WelcomeEmailListener } from './welcome-email.listener';
import { MailService } from './mail.service';
import { UserCreatedEvent } from '../users/events/user-created.event';

describe('WelcomeEmailListener', () => {
  let listener: WelcomeEmailListener;
  let mailService: DeepMocked<MailService>;

  beforeEach(() => {
    mailService = createMock<MailService>();
    mailService.sendWelcomeEmail.mockResolvedValue(undefined);
    listener = new WelcomeEmailListener(mailService);
  });

  it('sends the welcome email to the new user', async () => {
    await listener.handleUserCreated(
      new UserCreatedEvent(1, 'ada@example.com'),
    );

    expect(mailService.sendWelcomeEmail).toHaveBeenCalledWith(
      'ada@example.com',
    );
  });

  // The listener itself doesn't catch: @nestjs/event-emitter's wrapper
  // does (suppressErrors). The E2E suite checks that a failure here
  // doesn't fail signup.
  it('lets a mail failure propagate to the event-emitter wrapper', async () => {
    mailService.sendWelcomeEmail.mockRejectedValue(new Error('SMTP down'));

    await expect(
      listener.handleUserCreated(new UserCreatedEvent(1, 'ada@example.com')),
    ).rejects.toThrow('SMTP down');
  });
});
