import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { WelcomeEmailListener } from './welcome-email.listener';

/**
 * Mail side effects. Nothing imports this module's providers: it reacts
 * to events (`user.created`) instead, so the modules that emit them don't
 * depend on it.
 */
@Module({
  providers: [MailService, WelcomeEmailListener],
})
export class MailModule {}
