import { Module } from '@nestjs/common';
import { EmailSharedModule } from '../../core/email/shared-email-module';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { AuthModule } from '../../shared/auth/auth.module';
import { PermissionsModule } from '../../shared/permissions/permissions.module';
import { QuackModule } from '../quack/quack.module';
import { QuackUserResolver } from './graphql/resolvers/quack-user.resolver';
import { UserResolver } from './graphql/resolvers/user.resolver';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    PermissionsModule,
    QuackModule,
    EmailSharedModule,
  ],
  providers: [UserRepository, UserService, UserResolver, QuackUserResolver],
})
export class UsersModule {}
