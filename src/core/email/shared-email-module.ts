import { Module } from '@nestjs/common';
import { EmailModule } from 'src/core/email/email.module';
import { EmailService } from 'src/core/email/interfaces/email-service.interface';
import { SMTPAdapterFactory } from 'src/core/email/smtp/smtp.adapter.factory';
import { Config } from 'src/shared/config/config.service';

/**
 * Mock email service used when SMTP is disabled
 */
class MockEmailService implements EmailService {
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    console.log('[MOCK EMAIL] Disabled SMTP. Would send email to:', to);
    console.log('[MOCK EMAIL] Subject:', subject);
    // Email service is disabled - do nothing
  }
}

@Module({
  imports: [
    EmailModule.forRootAsync({
      useFactory: async (config: Config) => {
        // Return mock service if SMTP is not configured (disabled)
        if (!config.smtpHost || !config.smtpUsername || !config.smtpPassword) {
          console.log('[EMAIL MODULE] SMTP disabled - using mock email service');
          return new MockEmailService();
        }
        return SMTPAdapterFactory.create({
          host: config.smtpHost,
          port: config.smtpPort ?? 465,
          secure: config.smtpSecure ?? true,
          user: config.smtpUsername,
          pass: config.smtpPassword,
        });
      },
      inject: [Config],
    }),
  ],
  exports: [EmailModule],
})
export class EmailSharedModule {}
