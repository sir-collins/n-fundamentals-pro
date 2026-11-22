import { Injectable, Logger } from '@nestjs/common';

/**
 * Stand-in for a real mail provider: logs what it would send. Sending
 * real email needs SMTP credentials and is a separate concern. A real
 * implementation can replace this class without touching signup, which
 * only emits an event and never sees this service.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendWelcomeEmail(email: string): Promise<void> {
    this.logger.log(`Would send welcome email to ${email}`);
    return Promise.resolve();
  }
}
