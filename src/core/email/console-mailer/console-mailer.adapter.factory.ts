import { EmailService } from '../interfaces/email-service.interface';
import { ConsoleMailerAdapter } from './services/console-mailer-adapter';

export class ConsoleMailerAdapterFactory {
  static create(): EmailService {
    return new ConsoleMailerAdapter();
  }
}
