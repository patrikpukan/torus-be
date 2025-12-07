import { Module } from "@nestjs/common";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { AuthorizationService } from "./services/authorization.service";
import { UserContextService } from "./services/user-context.service";
import { RoleGuard } from "./guards/role.guard";
import { OrgAdminGuard } from "./guards/org-admin.guard";
import { SuperAdminGuard } from "./guards/super-admin.guard";
import { AuthenticatedUserGuard } from "./guards/authenticated-user.guard";

/**
 * Authentication & Authorization Module
 *
 * Provides:
 * - AuthorizationService: Business logic for role-based access control
 * - UserContextService: User resolution and validation from GraphQL context
 * - Guards: OrgAdminGuard, SuperAdminGuard, RoleGuard, AuthenticatedUserGuard
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
  ],
  exports: [
    AuthorizationService,
    UserContextService,
    RoleGuard,
    OrgAdminGuard,
    SuperAdminGuard,
    AuthenticatedUserGuard,
  ],
})
export class AuthModule {}
