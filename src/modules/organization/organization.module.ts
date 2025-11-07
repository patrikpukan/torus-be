import { Module } from "@nestjs/common";
import { ConfigModule } from "@applifting-io/nestjs-decorated-config";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { OrganizationResolver } from "./graphql/resolvers/organization.resolver";
import { OrganizationRepository } from "./repositories/organization.repository";
import { OrganizationService } from "./services/organization.service";
import { InviteCodeService } from "./services/invite-code.service";
import { SupabaseAdminService } from "../../shared/auth/supabase-admin.service";
import { AuthModule } from "../../shared/auth/auth.module";

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  providers: [
    OrganizationRepository,
    OrganizationService,
    InviteCodeService,
    OrganizationResolver,
    SupabaseAdminService,
  ],
  exports: [OrganizationService, OrganizationRepository, InviteCodeService],
})
export class OrganizationModule {}
