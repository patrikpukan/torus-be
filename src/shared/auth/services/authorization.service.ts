import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "src/core/prisma/prisma.service";
import { Identity } from "../domain/identity";

export enum UserRole {
  USER = "user",
  ORG_ADMIN = "org_admin",
  SUPER_ADMIN = "super_admin",
}

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks if the requestor has one of the allowed roles.
   * Throws ForbiddenException if role is not in the allowed list.
   */
  checkRole(identity: Identity, allowedRoles: UserRole[]): void {
    if (!identity.appRole) {
      throw new ForbiddenException("User role not found");
    }

    const userRole = identity.appRole as UserRole;

    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${allowedRoles.join(", ")}, but user has: ${userRole}`
      );
    }
  }

  /**
   * Checks if requestor can view a specific user.
   * - super_admin: can view anyone
   * - org_admin: can view users in their organization
   * - user: can only view themselves and other users in the same organization
   */
  async canViewUser(
    requestor: Identity,
    targetUserId: string,
    targetOrgId?: string
  ): Promise<boolean> {
    // Super admin can view anyone
    if (requestor.appRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // If target org is not provided, fetch it from DB
    let targetOrgToCheck = targetOrgId;
    if (!targetOrgToCheck) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { organizationId: true },
      });
      targetOrgToCheck = targetUser?.organizationId;
    }

    // Get requestor's org
    const requestorOrgId =
      requestor.organizationId ||
      (
        await this.prisma.user.findUnique({
          where: { id: requestor.id },
          select: { organizationId: true },
        })
      )?.organizationId;

    // User can view themselves or other users in the same organization
    if (
      requestor.appRole === UserRole.USER ||
      requestor.appRole === UserRole.ORG_ADMIN
    ) {
      // Can view self
      if (requestor.id === targetUserId) {
        return true;
      }

      // Can view users in same organization
      if (
        requestorOrgId &&
        targetOrgToCheck &&
        requestorOrgId === targetOrgToCheck
      ) {
        return true;
      }

      return false;
    }

    return false;
  }

  /**
   * Checks if requestor can update a specific user.
   * - super_admin: can update anyone
   * - org_admin: can update users in their organization
   * - user: can only update themselves
   */
  async canUpdateUser(
    requestor: Identity,
    targetUserId: string,
    targetOrgId?: string
  ): Promise<boolean> {
    // Super admin can update anyone
    if (requestor.appRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Org admin can update users in their organization
    if (requestor.appRole === UserRole.ORG_ADMIN) {
      // Verify requestor is in the same org
      const requestorOrgId =
        requestor.organizationId ||
        (
          await this.prisma.user.findUnique({
            where: { id: requestor.id },
            select: { organizationId: true },
          })
        )?.organizationId;

      if (requestorOrgId === targetOrgId) {
        return true;
      }

      return false;
    }

    // User can only update themselves
    if (requestor.appRole === UserRole.USER) {
      return requestor.id === targetUserId;
    }

    return false;
  }

  /**
   * Checks if requestor can manage an organization.
   * - super_admin: can manage any organization
   * - org_admin: can only manage their own organization
   * - user: cannot manage any organization
   */
  async canManageOrganization(
    requestor: Identity,
    targetOrgId: string
  ): Promise<boolean> {
    // Super admin can manage any organization
    if (requestor.appRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Org admin can manage only their organization
    if (requestor.appRole === UserRole.ORG_ADMIN) {
      const requestorOrgId =
        requestor.organizationId ||
        (
          await this.prisma.user.findUnique({
            where: { id: requestor.id },
            select: { organizationId: true },
          })
        )?.organizationId;

      return requestorOrgId === targetOrgId;
    }

    return false;
  }

  /**
   * Checks if requestor can manage pairings (view, create, update).
   * - super_admin: can manage any pairing
   * - org_admin: can manage pairings in their organization
   * - user: cannot manage pairings (only can view their own)
   */
  async canManagePairings(
    requestor: Identity,
    targetOrgId: string
  ): Promise<boolean> {
    // Super admin can manage any pairing
    if (requestor.appRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Org admin can manage pairings in their organization
    if (requestor.appRole === UserRole.ORG_ADMIN) {
      const requestorOrgId =
        requestor.organizationId ||
        (
          await this.prisma.user.findUnique({
            where: { id: requestor.id },
            select: { organizationId: true },
          })
        )?.organizationId;

      return requestorOrgId === targetOrgId;
    }

    return false;
  }

  /**
   * Throws ForbiddenException if requestor cannot perform the action.
   */
  throwIfNoPermission(hasPermission: boolean): void {
    if (!hasPermission) {
      throw new ForbiddenException(
        "You do not have permission to perform this action"
      );
    }
  }
}
