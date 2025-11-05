import { Module } from "@nestjs/common";
import { ConfigModule } from "@applifting-io/nestjs-decorated-config";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { UserResolver } from "./graphql/resolvers/user.resolver";
import { UserRepository } from "./repositories/user.repository";
import { UserService } from "./services/user.service";
import { AuthenticatedUserGuard } from "../../shared/auth/guards/authenticated-user.guard";
import { SupabaseAdminService } from "../../shared/auth/supabase-admin.service";
import { OrganizationModule } from "../organization/organization.module";

@Module({
  imports: [ConfigModule, PrismaModule, OrganizationModule],
  providers: [
    UserRepository,
    UserService,
    UserResolver,
    AuthenticatedUserGuard,
    SupabaseAdminService,
  ],
})
export class UsersModule {}
