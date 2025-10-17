import { Module } from '@nestjs/common';
import { EmailModule } from 'src/core/email/email.module';
import { SMTPAdapterFactory } from 'src/core/email/smtp/smtp.adapter.factory';
import { Config } from 'src/shared/config/config.service';

@Module({
  imports: [
    EmailModule.forRootAsync({
      useFactory: async (config: Config) => {
        return SMTPAdapterFactory.create({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpSecure,
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
