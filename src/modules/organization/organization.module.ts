import { Module } from "@nestjs/common";
import { ConfigModule } from "@applifting-io/nestjs-decorated-config";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { OrganizationResolver } from "./graphql/resolvers/organization.resolver";
import { OrganizationRepository } from "./repositories/organization.repository";
import { OrganizationService } from "./services/organization.service";
import { InviteCodeService } from "./services/invite-code.service";
import { SupabaseAdminService } from "../../shared/auth/supabase-admin.service";

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    OrganizationRepository,
    OrganizationService,
    InviteCodeService,
    OrganizationResolver,
    SupabaseAdminService,
  ],
  exports: [OrganizationService, InviteCodeService, OrganizationRepository],
})
export class OrganizationModule {}
