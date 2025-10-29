/**
 * AUTHORIZATION SYSTEM - Backend Documentation
 *
 * This guide explains how to use the authorization system to protect your endpoints.
 *
 * ## 3 Role Levels
 *
 * 1. **user** - Regular user
 *    - Can view/edit only their own profile
 *    - Can view other users in the same organization
 *    - Cannot manage anything
 *
 * 2. **org_admin** - Organization administrator
 *    - Can manage users in their organization
 *    - Can manage organization settings (pairing periods, algorithms, etc.)
 *    - Can only manage their own organization
 *
 * 3. **super_admin** - Super administrator
 *    - Can manage anything, all organizations and all users
 *    - Global access
 *
 * ## Methods to Use
 *
 * ### 1. Role Guard (Simple Role Check)
 *
 * Use when you want to restrict access based on ONLY the role level.
 *
 * ```typescript
 * import { UseGuards } from "@nestjs/common";
 * import { OrgAdminGuard } from "src/shared/auth/guards/org-admin.guard";
 * import { SuperAdminGuard } from "src/shared/auth/guards/super-admin.guard";
 *
 * @Resolver(() => SomeType)
 * export class SomeResolver {
 *
 *   // Only org_admin and super_admin can access
 *   @UseGuards(OrgAdminGuard)
 *   @Mutation(() => SomeType)
 *   async manageSomething() { ... }
 *
 *   // Only super_admin can access
 *   @UseGuards(SuperAdminGuard)
 *   @Mutation(() => Boolean)
 *   async deleteOrganization() { ... }
 * }
 * ```
 *
 * ### 2. @RequireRole Decorator (Flexible Role Check)
 *
 * Use when you want to specify multiple roles allowed.
 *
 * ```typescript
 * import { RequireRole } from "src/shared/auth/decorators/require-role.decorator";
 * import { UserRole } from "src/shared/auth/services/authorization.service";
 *
 * @Resolver(() => SomeType)
 * export class SomeResolver {
 *
 *   // Only org_admin and super_admin
 *   @RequireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
 *   @Query(() => [SomeType])
 *   async listOrganizationItems() { ... }
 *
 *   // Only super_admin
 *   @RequireRole(UserRole.SUPER_ADMIN)
 *   @Query(() => [Organization])
 *   async allOrganizations() { ... }
 * }
 * ```
 *
 * ### 3. Authorization Service (Complex Checks)
 *
 * Use when you need to check resource-specific permissions (e.g., can this user edit that specific user?).
 * This is more flexible and allows checking relationships between resources.
 *
 * ```typescript
 * import { AuthorizationService } from "src/shared/auth/services/authorization.service";
 *
 * @Injectable()
 * export class UserService {
 *   constructor(private authService: AuthorizationService) {}
 *
 *   async getUserById(identity: Identity, targetUserId: string): Promise<User | null> {
 *     // Check if requestor can view this specific user
 *     const canView = await this.authService.canViewUser(identity, targetUserId);
 *     this.authService.throwIfNoPermission(canView);
 *
 *     // Proceed with business logic
 *     return this.userRepository.getUserById(targetUserId);
 *   }
 *
 *   async updateUser(identity: Identity, targetUserId: string, data: UpdateUserDto): Promise<User> {
 *     // Check if requestor can update this specific user
 *     const canUpdate = await this.authService.canUpdateUser(identity, targetUserId);
 *     this.authService.throwIfNoPermission(canUpdate);
 *
 *     // Proceed with update
 *     return this.userRepository.updateUser(targetUserId, data);
 *   }
 * }
 * ```
 *
 * ## Available Authorization Service Methods
 *
 * ### checkRole(identity, allowedRoles)
 * Throws ForbiddenException if user doesn't have one of the allowed roles.
 *
 * ```typescript
 * this.authService.checkRole(identity, [UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN]);
 * ```
 *
 * ### canViewUser(requestor, targetUserId, targetOrgId?)
 * Returns boolean. Checks if requestor can view a specific user.
 *
 * ```typescript
 * const canView = await this.authService.canViewUser(identity, userId);
 * ```
 *
 * ### canUpdateUser(requestor, targetUserId, targetOrgId?)
 * Returns boolean. Checks if requestor can update a specific user.
 *
 * ```typescript
 * const canUpdate = await this.authService.canUpdateUser(identity, userId);
 * ```
 *
 * ### canManageOrganization(requestor, organizationId)
 * Returns boolean. Checks if requestor can manage a specific organization.
 *
 * ```typescript
 * const canManage = await this.authService.canManageOrganization(identity, orgId);
 * ```
 *
 * ### canManagePairings(requestor, organizationId)
 * Returns boolean. Checks if requestor can manage pairings in an organization.
 *
 * ```typescript
 * const canManage = await this.authService.canManagePairings(identity, orgId);
 * ```
 *
 * ### throwIfNoPermission(hasPermission)
 * Throws ForbiddenException if hasPermission is false.
 *
 * ```typescript
 * const hasPermission = await this.authService.canViewUser(identity, userId);
 * this.authService.throwIfNoPermission(hasPermission);
 * ```
 *
 * ## Examples
 *
 * ### Example 1: List only users in the same organization
 *
 * ```typescript
 * @UseGuards(AuthenticatedUserGuard)
 * @Query(() => [UserType])
 * async users(@User() identity: Identity): Promise<UserType[]> {
 *   return this.userService.listUsers(identity);
 * }
 *
 * // In UserService:
 * async listUsers(identity: Identity): Promise<User[]> {
 *   const requestorOrgId = await this.getOrgId(identity);
 *
 *   // Super admin sees all, others see only their org
 *   if (identity.appRole === UserRole.SUPER_ADMIN) {
 *     return this.userRepository.listAllUsers();
 *   }
 *
 *   return this.userRepository.listUsersByOrgId(requestorOrgId);
 * }
 * ```
 *
 * ### Example 2: Protect admin-only endpoint
 *
 * ```typescript
 * @RequireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
 * @Mutation(() => PairingPeriodType)
 * async createPairingPeriod(
 *   @User() identity: Identity,
 *   @Args("data") data: CreatePairingPeriodDto
 * ): Promise<PairingPeriod> {
 *   // Verify the org_admin can manage this specific organization
 *   const canManage = await this.authService.canManageOrganization(identity, data.organizationId);
 *   this.authService.throwIfNoPermission(canManage);
 *
 *   return this.pairingService.createPeriod(data);
 * }
 * ```
 *
 * ### Example 3: Check both role and resource permission
 *
 * ```typescript
 * @UseGuards(AuthenticatedUserGuard)
 * @Mutation(() => UserType)
 * async updateUser(
 *   @User() identity: Identity,
 *   @Args("data") data: UpdateUserDto
 * ): Promise<User> {
 *   const canUpdate = await this.authService.canUpdateUser(identity, data.id);
 *   this.authService.throwIfNoPermission(canUpdate);
 *
 *   return this.userService.updateUser(data.id, data);
 * }
 * ```
 */
