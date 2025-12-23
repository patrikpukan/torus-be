import { SetMetadata, UseGuards, applyDecorators } from "@nestjs/common";
import { AuthenticatedUserGuard } from "../guards/authenticated-user.guard";
import { RoleGuard } from "../guards/role.guard";
import { UserRole } from "../services/authorization.service";

/**
 * Decorator to restrict access to endpoints based on user roles.
 *
 * Usage:
 * @RequireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
 * @Query()
 * async someQuery() { ... }
 *
 * @RequireRole(UserRole.SUPER_ADMIN)
 * @Mutation()
 * async someAdminMutation() { ... }
 */
export function RequireRole(...allowedRoles: UserRole[]) {
  return applyDecorators(
    SetMetadata("allowedRoles", allowedRoles),
    UseGuards(AuthenticatedUserGuard, RoleGuard)
  );
}
