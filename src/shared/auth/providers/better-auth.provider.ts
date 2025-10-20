import { Inject, Provider } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { EmailService } from 'src/core/email/interfaces/email-service.interface';
import { EmailVerificationTemplateVariables } from 'src/shared/email-template/interfaces/email-verification-variables.interface';
import { PasswordResetTemplateVariables } from 'src/shared/email-template/interfaces/password-reset-variables.interface';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { betterAuthCoreConfig } from '../../../shared/auth/config/better-auth.config';
import { Config } from '../../config/config.service';
import { EmailTemplateService } from '../../email-template/email-template.service';

const createAuth = (
  prismaService: PrismaService,
  config: Config,
  emailProvider: EmailService,
  emailTemplateService: EmailTemplateService,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) =>
  betterAuth({
    // apply shared defaults first so we can extend them without losing settings
    ...betterAuthCoreConfig,
    database: prismaAdapter(prismaService, {
      provider: 'postgresql',
    }),
    emailAndPassword: {
      ...(betterAuthCoreConfig.emailAndPassword ?? {}),
      enabled: true,
      sendResetPassword: async ({ user, token }) => {
        const passwordResetUrl = `${config.frontendBaseUrl}/${config.frontendResetPasswordUrl}?token=${token}`;
        const compiledTemplate =
          await emailTemplateService.compileTemplate<PasswordResetTemplateVariables>(
            {
              templatePath: 'reset-password.html',
              variables: {
                username: user.email,
                url: passwordResetUrl,
              },
            },
          );
        await emailProvider.sendEmail(
          user.email,
          'Password reset',
          compiledTemplate,
        );
      },
    },
    user: {
      ...(betterAuthCoreConfig.user ?? {}),
      additionalFields: {
        ...(betterAuthCoreConfig.user?.additionalFields ?? {}),
        role: {
          type: 'string',
          required: true,
          defaultValue: 'user',
          input: false,
        },
      },
    },
    trustedOrigins: [config.frontendBaseUrl, config.frontendProdUrl].filter(
      (origin): origin is string => typeof origin === 'string',
    ),
    emailVerification: {
      ...(betterAuthCoreConfig.emailVerification ?? {}),
      sendVerificationEmail: async ({ user, url }) => {
        const compiledTemplate =
          await emailTemplateService.compileTemplate<EmailVerificationTemplateVariables>(
            {
              templatePath: 'verify-email.html',
              variables: { url },
            },
          );

        await emailProvider.sendEmail(
          user.email,
          'Verify your email address',
          compiledTemplate,
        );
      },
      sendOnSignUp: true,
    },
    plugins: [...(betterAuthCoreConfig.plugins ?? [])],
  });

export type BetterAuth = ReturnType<typeof createAuth>;

export const betterAuthProvider: Provider = {
  provide: 'BetterAuth',
  useFactory: (
    prismaService: PrismaService,
    config: Config,
    emailProvider: EmailService,
    emailTemplateService: EmailTemplateService,
  ) => createAuth(prismaService, config, emailProvider, emailTemplateService),
  inject: [PrismaService, Config, 'EmailService', EmailTemplateService],
};

export const InjectBetterAuth = Inject('BetterAuth');
