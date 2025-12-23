import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../../core/prisma/prisma.service";

export interface ResolvedUser {
  id: string;
  organizationId: string;
  role: string;
  appRole?: string;
}

export type UserContextInput = {
  id?: string;
  role?: string;
  appRole?: string;
  organizationId?: string;
} | null;

@Injectable()
export class UserContextService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the current authenticated user from GraphQL context.
   * First checks if user data is already available in context (from decorator),
   * otherwise queries the database.
   *
   * @param context - GraphQL context containing user data
   * @returns ResolvedUser with id, organizationId, and role
   * @throws UnauthorizedException if user not found
   * @throws ForbiddenException if user account not found in database
   */
  async resolveCurrentUser(
    userContext: UserContextInput
  ): Promise<ResolvedUser> {
    if (!userContext?.id) {
      throw new UnauthorizedException("Authenticated user context is missing");
    }

    // If user already has organizationId and role in context, return it
    if (userContext.organizationId && userContext.role) {
      return {
        id: userContext.id,
        organizationId: userContext.organizationId,
        role: userContext.role,
        appRole: userContext.appRole,
      };
    }

    // Otherwise, fetch from database
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userContext.id },
      select: {
        id: true,
        organizationId: true,
        role: true,
      },
    });

    if (!dbUser || !dbUser.organizationId) {
      throw new ForbiddenException("User account not found or incomplete");
    }

    return {
      id: dbUser.id,
      organizationId: dbUser.organizationId,
      role: dbUser.role,
      appRole: userContext.appRole,
    };
  }

  /**
   * Validates that the current user has admin privileges (org_admin or super_admin).
   * Does NOT check organization membership - use validateUserBelongsToOrg for that.
   *
   * @param user - Resolved user object
   * @throws ForbiddenException if user is not an admin
   */
  validateUserIsAdmin(user: ResolvedUser): void {
    const role = user.appRole ?? user.role;

    if (!role) {
      throw new ForbiddenException("User role is missing");
    }

    const normalizedRole = String(role);
    const isAdminRole =
      normalizedRole === "admin" ||
      normalizedRole === UserRole.org_admin ||
      normalizedRole === UserRole.super_admin;

    if (!isAdminRole) {
      throw new ForbiddenException("Admin access required");
    }
  }

  /**
   * Validates that the user belongs to the specified organization.
   * Super admins can access any organization.
   *
   * @param user - Resolved user object
   * @param organizationId - Organization ID to check access for
   * @throws ForbiddenException if user doesn't have access to organization
   */
  validateUserBelongsToOrg(user: ResolvedUser, organizationId: string): void {
    const role = user.appRole ?? user.role;
    const normalizedRole = String(role ?? "");

    // Super admins can access any organization
    if (
      normalizedRole === UserRole.super_admin ||
      user.appRole === UserRole.super_admin
    ) {
      return;
    }

    // For non-super-admins, check organization membership
    if (user.organizationId !== organizationId) {
      throw new ForbiddenException("Access denied to organization");
    }
  }

  /**
   * Combined validation: user must be admin AND belong to the organization.
   * Convenience method for common pattern.
   *
   * @param user - Resolved user object
   * @param organizationId - Organization ID to validate access for
   * @throws ForbiddenException for admin or organization access violations
   */
  validateAdminAccessToOrg(user: ResolvedUser, organizationId: string): void {
    this.validateUserIsAdmin(user);
    this.validateUserBelongsToOrg(user, organizationId);
  }
}
