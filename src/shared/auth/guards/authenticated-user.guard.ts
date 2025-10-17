import { ExecutionContext, Injectable } from '@nestjs/common';
import { ContextType } from '@nestjs/common/interfaces/features/arguments-host.interface';
import { GqlExecutionContext } from '@nestjs/graphql';
import {
  BetterAuth,
  InjectBetterAuth,
} from '../providers/better-auth.provider';
import { getSessionFromRequest } from '../utils/get-session-from-request';

@Injectable()
export class AuthenticatedUserGuard {
  constructor(@InjectBetterAuth private readonly betterAuth: BetterAuth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);

    const session = await getSessionFromRequest(request, this.betterAuth);

    if (!session) {
      return false;
    }

    if (context.getType<ContextType | 'graphql'>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      ctx.getContext().session = session;
    } else {
      request.session = session;
    }

    return true;
  }

  // todo: figure out proper typing here
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getRequest(context: ExecutionContext): any {
    const ctx = GqlExecutionContext.create(context);
    const { req, connection } = ctx.getContext();

    if (context.getType<ContextType | 'graphql'>() === 'graphql') {
      return connection && connection.context && connection.context.headers
        ? connection.context
        : req;
    } else if (context.switchToHttp().getRequest() instanceof Object) {
      return context.switchToHttp().getRequest();
    }
  }
}
