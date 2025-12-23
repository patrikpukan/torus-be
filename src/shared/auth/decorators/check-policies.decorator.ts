import { SetMetadata } from "@nestjs/common";
import { PolicyHandler } from "../guards/policies.guard";

/**
 * Metadata key for storing policy handlers on resolver methods.
 * Used by PoliciesGuard to retrieve the handlers to check.
 */
export const CHECK_POLICIES_KEY = "check_policies";

/**
 * Check Policies Decorator
 *
 * Marks a resolver method with one or more policy handlers.
 * These handlers define what abilities a user must have to access the method.
 *
 * USAGE:
 * Apply to resolver methods that need authorization checks.
 * Works in conjunction with @UseGuards(PoliciesGuard).
 *
 * POLICY LOGIC:
 * - Multiple handlers use OR logic (user needs to satisfy ANY handler)
 * - Each handler receives the user's ability and returns boolean
 *
 * EXAMPLES:
 *
 * // Single policy - user must be able to manage organization
 * @CheckPolicies((ability) => ability.can('manage', 'Organization'))
 *
 * // Multiple policies - user must be able to do ONE of these
 * @CheckPolicies(
 *   (ability) => ability.can('manage', 'AlgorithmSettings'),
 *   (ability) => ability.can('manage', 'Organization')
 * )
 *
 * // Complex policy - check specific instance access
 * @CheckPolicies((ability) => ability.can('read', organizationInstance))
 *
 * // With RequireRole for additional filtering
 * @CheckPolicies((ability) => ability.can('manage', 'AlgorithmSettings'))
 * @RequireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
 *
 * @param handlers - One or more policy handler functions
 */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
