import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import {
  AuthorizationService,
  UserRole,
} from "../services/authorization.service";
import { Identity } from "../domain/identity";

/**
 * Guard to ensure user has super_admin role
 *
 * Usage: @UseGuards(SuperAdminGuard)
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly authService: AuthorizationService) {}

  canActivate(context: ExecutionContext): boolean {
    const graphqlContext = GqlExecutionContext.create(context);
    const { user, req } = graphqlContext.getContext<{
      user?: Identity | null;
      req?: { user?: Identity | null };
    }>();

    const identity = user ?? req?.user ?? null;

    if (!identity) {
      throw new ForbiddenException("Authentication required");
    }

    this.authService.checkRole(identity, [UserRole.SUPER_ADMIN]);
    return true;
  }
}
