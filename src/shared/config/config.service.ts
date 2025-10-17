import { Env } from '@applifting-io/nestjs-decorated-config';
import { Injectable, LogLevel } from '@nestjs/common';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsSemVer,
  IsUrl,
} from 'class-validator';

/**
 * A config class that is populated from environment variables and enable the use of validation decorators.
 */
@Injectable()
export class Config {
  // basic info
  readonly name: string = 'Quacker backend';
  readonly description: string =
    'Backend for Quacker, a social media platform for sharing short messages. Project example for educational purposes.';

  @IsSemVer()
  readonly version: string = '0.1.0';

  @Env<string>('CI_COMMIT_SHA', { expose: true })
  @IsOptional()
  readonly gitCommitSha?: string;

  @Env<string>('BETTER_AUTH_SECRET')
  @IsNotEmpty()
  readonly betterAuthSecret!: string;

  @Env('SUPERADMIN_EMAIL')
  readonly superadminEmail!: string;

  @Env('SUPERADMIN_PASSWORD')
  readonly superadminPassword!: string;

  @Env('NODE_ENV', { expose: true })
  @IsOptional()
  readonly nodeEnv?: string;

  @Env('ENV_NAME', { expose: true })
  @IsOptional()
  readonly envName?: string;

  /**
   * FIXME: This should be settable via env variable
   *        Current `@Env` cannot works with arrays
   */
  readonly logLevels: LogLevel[] = ['error', 'fatal', 'log'];

  @Env('BASE_URL', {
    defaultValue: 'http://localhost:4000',
    expose: true,
    removeTrailingSlash: true,
  })
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  readonly baseUrl!: string;

  @Env('FRONTEND_BASE_URL', {
    defaultValue: 'http://localhost:3000',
    expose: true,
    removeTrailingSlash: true,
  })
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  readonly frontendBaseUrl!: string;

  @Env('FRONTEND_PROD_URL', {
    defaultValue: 'http://localhost:3001',
    expose: true,
    removeTrailingSlash: true,
  })
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  readonly frontendProdUrl!: string;

  @Env('FRONTEND_RESET_PASSWORD_ROUTE', {
    defaultValue: 'reset-password',
    expose: true,
  })
  @IsNotEmpty()
  readonly frontendResetPasswordUrl!: string;

  @Env('PORT', { expose: true, defaultValue: 4000 })
  readonly port!: number;

  @Env('DATABASE_URL', {
    expose: true,
    defaultValue: 'postgres://postgres:password4251@postgres:5432/example',
  })
  readonly postgresConnectionString!: string;

  @Env('DATABASE_PROVIDER', {
    expose: true,
    defaultValue: 'postgresql',
  })
  readonly databaseProvider!: string;

  @Env('POSTGRES_SSL', { expose: true, defaultValue: false })
  @IsBoolean()
  readonly postgresSsl!: boolean;

  @Env('PRISMA_LOG', {
    expose: true,
    parseArray: true,
  })
  readonly prismaLog!: ('query' | 'info' | 'warn' | 'error')[];

  @Env('LOG_HTTP_CLIENT_REQUESTS', { defaultValue: true, expose: true })
  @IsBoolean()
  readonly logHttpClientRequests!: boolean;

  /**
   * Default cache config for rest endpoints
   */
  @Env('CACHE_TTL_MS', { defaultValue: 10 * 1000, expose: true })
  readonly cacheTtlMs!: number;

  /**
   * Default cache config for rest endpoints
   */
  @Env('CACHE_MAX_ITEMS', { defaultValue: 1000, expose: true })
  readonly cacheMaxItems!: number;

  @Env('PRETTY_PRINT_LOGS', { expose: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  readonly prettyPrintLogs?: boolean;

  @Env('SMTP_HOST', { expose: true })
  readonly smtpHost!: string;

  @Env('SMTP_SECURE', { expose: true, defaultValue: true })
  @IsBoolean()
  readonly smtpSecure!: boolean;

  @Env('SMTP_PORT', { expose: true, defaultValue: 465 })
  readonly smtpPort!: number;

  @Env('SMTP_USERNAME', { expose: true })
  readonly smtpUsername!: string;

  @Env('SMTP_PASSWORD')
  readonly smtpPassword!: string;
}
