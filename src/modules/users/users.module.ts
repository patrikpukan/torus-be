import {Module} from '@nestjs/common';
import {EmailSharedModule} from '../../core/email/shared-email-module';
import {PrismaModule} from '../../core/prisma/prisma.module';
import {UserResolver} from './graphql/resolvers/user.resolver';
import {UserRepository} from './repositories/user.repository';
import {UserService} from './services/user.service';

@Module({
  imports: [
    PrismaModule,
    EmailSharedModule,
  ],
  providers: [UserRepository, UserService, UserResolver],
})
export class UsersModule {}
