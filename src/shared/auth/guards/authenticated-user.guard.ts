import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { Identity } from "../domain/identity";

@Injectable()
export class AuthenticatedUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const graphqlContext = GqlExecutionContext.create(context);
    const { user, req } = graphqlContext.getContext<{
      user?: Identity | null;
      req?: { user?: Identity | null };
    }>();

    const identity = user ?? req?.user ?? null;

    if (!identity) {
      throw new UnauthorizedException("Authentication required");
    }

    return true;
  }
}
