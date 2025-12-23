import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GqlExecutionContext } from "@nestjs/graphql";
import { CaslAbilityFactory, AppAbility } from "../casl/casl-ability.factory";
import { Identity } from "../domain/identity";
import { CHECK_POLICIES_KEY } from "../decorators/check-policies.decorator";

/**
 * Type for policy checker function.
 * A policy receives the ability and returns whether the action is allowed.
 *
 * @example
 * (ability) => ability.can('manage', 'Organization')
 * (ability) => ability.can('read', organizationId)
 */
export type PolicyHandler = (ability: AppAbility) => boolean;

/**
 * Policies Guard
 *
 * Implements CanActivate interface to protect GraphQL resolvers.
 * Checks if the current user has the required abilities to access a resolver.
 *
 * USAGE:
 * 1. Decorate resolver with @CheckPolicies(handler) or @CheckPolicies(handler1, handler2, ...)
 * 2. Guard will:
 *    a. Extract current user from GraphQL context
 *    b. Build ability object based on user role
 *    c. Execute all policy handlers
 *    d. Allow access if ANY handler returns true (OR logic)
 *    e. Throw ForbiddenException if all handlers return false
 *
 * @example
 * @Mutation()
 * @UseGuards(PoliciesGuard)
 * @CheckPolicies(
 *   (ability) => ability.can('manage', 'Organization'),
 *   (ability) => ability.can('manage', 'AlgorithmSettings')
 * )
 * async updateOrganization(...) { }
 *
 * @example
 * @Query()
 * @UseGuards(PoliciesGuard)
 * @CheckPolicies((ability) => ability.can('read', 'User'))
 * async getUsers(...) { }
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory
  ) {}

  /**
   * Determines if the current user can access the protected resolver.
   *
   * @param context - GraphQL execution context
   * @returns true if user has required ability, false otherwise
   * @throws ForbiddenException if no policies defined or all policies fail
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Extract policy handlers from decorator metadata
    const policyHandlers = this.reflector.get<PolicyHandler[]>(
      CHECK_POLICIES_KEY,
      context.getHandler()
    );

    // If no policies defined, deny access (fail-safe)
    if (!policyHandlers || policyHandlers.length === 0) {
      throw new ForbiddenException("No policies defined for this resource");
    }

    // Get GraphQL execution context
    const gqlContext = GqlExecutionContext.create(context);
    const { req } = gqlContext.getContext();

    // Extract user identity from request
    // Assumes identity is set by AuthenticatedUserGuard or similar
    const identity: Identity | null = req.user;

    if (!identity) {
      throw new ForbiddenException("User context not found");
    }

    // Build ability for current user based on their role
    const ability = this.caslAbilityFactory.createForUser(identity);

    // Check if user satisfies ANY of the required policies (OR logic)
    // At least one policy must return true
    const hasAccess = policyHandlers.some((handler: PolicyHandler) =>
      handler(ability)
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        "You do not have permission to perform this action"
      );
    }

    return true;
  }
}
