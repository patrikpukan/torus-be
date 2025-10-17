import { Injectable } from '@nestjs/common';
import { EmailService } from '../../interfaces/email-service.interface';

@Injectable()
export class ConsoleMailerAdapter implements EmailService {
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    console.log(`
      ====== Email Sent ======
      To: ${to}
      Subject: ${subject}
      html:
      ${html}
      ========================
    `);
  }
}
