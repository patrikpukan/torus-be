import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/core/prisma/prisma.module';
import { EmailSharedModule } from '../../core/email/shared-email-module';
import { EmailTemplateModule } from '../email-template/email-template.module';
import { UserRepository } from 'src/modules/users/repositories/user.repository';
import { betterAuthProvider } from './providers/better-auth.provider';
import { AuthService } from './services/auth.service';
import { AuthHttpRouter } from './http/auth-http.router';
import { OrgAdminRepository } from './repositories/org-admin.repository';

@Module({
  imports: [PrismaModule, EmailSharedModule, EmailTemplateModule],
  providers: [betterAuthProvider, AuthService, AuthHttpRouter, OrgAdminRepository, UserRepository],
  exports: [betterAuthProvider, AuthService, AuthHttpRouter, OrgAdminRepository, UserRepository],
})
export class AuthModule {}
