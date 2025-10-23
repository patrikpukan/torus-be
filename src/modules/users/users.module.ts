import {Module} from '@nestjs/common';
import {ConfigModule} from '@applifting-io/nestjs-decorated-config';
import {EmailSharedModule} from '../../core/email/shared-email-module';
import {PrismaModule} from '../../core/prisma/prisma.module';
import {UserResolver} from './graphql/resolvers/user.resolver';
import {UserRepository} from './repositories/user.repository';
import {UserService} from './services/user.service';
import {AuthenticatedUserGuard} from '../../shared/auth/guards/authenticated-user.guard';
import {SupabaseAdminService} from '../../shared/auth/supabase-admin.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    EmailSharedModule,
  ],
  providers: [UserRepository, UserService, UserResolver, AuthenticatedUserGuard, SupabaseAdminService],
})
export class UsersModule {}
