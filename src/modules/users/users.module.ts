import { Module, forwardRef } from "@nestjs/common";
import { ConfigModule } from "@applifting-io/nestjs-decorated-config";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { UserResolver } from "./graphql/resolvers/user.resolver";
import { UserRepository } from "./repositories/user.repository";
import { UserService } from "./services/user.service";
import { AuthenticatedUserGuard } from "../../shared/auth/guards/authenticated-user.guard";
import { SupabaseAdminService } from "../../shared/auth/supabase-admin.service";
import { OrganizationModule } from "../organization/organization.module";
import { UserBanRepository } from "./repositories/user-ban.repository";
import { AuthModule } from "../../shared/auth/auth.module";
import { EmailService } from "../../shared/email/email.service";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    forwardRef(() => OrganizationModule),
  ],
  providers: [
    UserRepository,
    UserBanRepository,
    UserService,
    UserResolver,
    AuthenticatedUserGuard,
    SupabaseAdminService,
    EmailService,
  ],
})
export class UsersModule {}
