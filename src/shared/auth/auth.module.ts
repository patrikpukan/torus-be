import { Module } from "@nestjs/common";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { AuthorizationService } from "./services/authorization.service";
import { UserContextService } from "./services/user-context.service";
import { RoleGuard } from "./guards/role.guard";
import { OrgAdminGuard } from "./guards/org-admin.guard";
import { SuperAdminGuard } from "./guards/super-admin.guard";
import { AuthenticatedUserGuard } from "./guards/authenticated-user.guard";
import { PoliciesGuard } from "./guards/policies.guard";
import { CaslAbilityFactory } from "./casl/casl-ability.factory";

/**
 * Authentication & Authorization Module
 *
 * Provides:
 * - AuthorizationService: Business logic for role-based access control
 * - UserContextService: User resolution and validation from GraphQL context
 * - Guards: OrgAdminGuard, SuperAdminGuard, RoleGuard, AuthenticatedUserGuard, PoliciesGuard
 * - CaslAbilityFactory: Fine-grained permission system using CASL
 *
 * Usage:
 * Import this module in your module to use the authorization system.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    AuthorizationService,
    UserContextService,
    RoleGuard,
    OrgAdminGuard,
    SuperAdminGuard,
    AuthenticatedUserGuard,
    PoliciesGuard,
    CaslAbilityFactory,
  ],
  exports: [
    AuthorizationService,
    UserContextService,
    RoleGuard,
    OrgAdminGuard,
    SuperAdminGuard,
    AuthenticatedUserGuard,
    PoliciesGuard,
    CaslAbilityFactory,
  ],
})
export class AuthModule {}
