import { ConfigModule } from '@applifting-io/nestjs-decorated-config';
import { Module } from '@nestjs/common';
import { ConsoleMailerAdapterFactory } from '../../core/email/console-mailer/console-mailer.adapter.factory';
import { EmailModule } from '../../core/email/email.module';
import { PrismaService } from '../../core/prisma/prisma.service';
import { betterAuthProvider } from '../../shared/auth/providers/better-auth.provider';
import { Config } from '../../shared/config/config.service';
import { EmailTemplateModule } from '../../shared/email-template/email-template.module';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

@Module({
  imports: [
    ConfigModule.forRootAsync(Config, { validate: true, printOnStartup: true }),
    EmailModule.forRootAsync({
      useFactory: async () => {
        return ConsoleMailerAdapterFactory.create();
      },
      inject: [Config],
    }),
    EmailTemplateModule,
  ],
  providers: [Config, PrismaService, betterAuthProvider, SeedService],
  controllers: [SeedController],
})
export class SeedModule {}
