import { Injectable, Logger } from '@nestjs/common';

/**
 * Stand-in for a real mail provider: logs what it would send. A real
 * implementation can replace it without touching signup, which only emits
 * an event.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendWelcomeEmail(email: string): Promise<void> {
    this.logger.log(`Would send welcome email to ${email}`);
    return Promise.resolve();
  }
}
