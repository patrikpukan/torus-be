import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GqlExecutionContext } from "@nestjs/graphql";
import {
  AuthorizationService,
  UserRole,
} from "../services/authorization.service";
import { Identity } from "../domain/identity";

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthorizationService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Get allowed roles from metadata (set by @RequireRole decorator)
    const allowedRoles = this.reflector.get<UserRole[]>(
      "allowedRoles",
      context.getHandler()
    );

    // If no roles are specified, allow access
    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    // Get user from context
    const graphqlContext = GqlExecutionContext.create(context);
    const { user, req } = graphqlContext.getContext<{
      user?: Identity | null;
      req?: { user?: Identity | null };
    }>();

    const identity = user ?? req?.user ?? null;

    if (!identity) {
      throw new ForbiddenException("Authentication required");
    }

    // Check if user has one of the allowed roles
    this.authService.checkRole(identity, allowedRoles);
    return true;
  }
}
