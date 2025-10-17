import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/core/prisma/prisma.module';
import { EmailSharedModule } from '../../core/email/shared-email-module';
import { EmailTemplateModule } from '../email-template/email-template.module';
import { betterAuthProvider } from './providers/better-auth.provider';

@Module({
  imports: [PrismaModule, EmailSharedModule, EmailTemplateModule],
  providers: [betterAuthProvider],
  exports: [betterAuthProvider],
})
export class AuthModule {}
