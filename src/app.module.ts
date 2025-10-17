import { join } from 'node:path';
import { ConfigModule } from '@applifting-io/nestjs-decorated-config';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { QuackModule } from './modules/quack/quack.module';
import { UsersModule } from './modules/users/users.module';
import { WelcomeModule } from './modules/welcome/welcome.module';
import { SeedModule } from './scripts/seed/seed.module';
import { AuthModule } from './shared/auth/auth.module';
import { Config } from './shared/config/config.service';
import { GraphqlSetupModule } from './shared/graphql/graphql-setup.module';
import { LoggerModule } from './shared/logger/logger.module';

const imports = [
  LoggerModule,
  ConfigModule.forRootAsync(Config, { validate: true, printOnStartup: true }),
  ServeStaticModule.forRoot({
    rootPath: join(process.cwd(), 'uploads'),
    serveRoot: '/uploads', // This means files are accessible under http://host/uploads/...
  }),
  SeedModule,
  AuthModule,
  WelcomeModule,
  QuackModule,
  UsersModule,
  WelcomeModule,
  GraphqlSetupModule,
];

@Module({
  imports,
})
export class AppModule {}
