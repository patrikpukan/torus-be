import { ExecutionContext, Injectable } from '@nestjs/common';
import { ContextType } from '@nestjs/common/interfaces/features/arguments-host.interface';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { BetterAuth } from '../providers/better-auth.provider';
import { InjectBetterAuth } from '../providers/better-auth.provider';
import { getSessionFromRequest } from '../utils/get-session-from-request';
import { UserRepository } from 'src/modules/users/repositories/user.repository';

@Injectable()
export class AuthenticatedUserGuard {
  constructor(
    @InjectBetterAuth private readonly betterAuth: BetterAuth,
    private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);

    const session = await getSessionFromRequest(request, this.betterAuth);

    if (!session) {
      return false;
    }

    await this.enrichSessionWithRole(session);

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

  private async enrichSessionWithRole(session: any): Promise<void> {
    if (!session?.user || session.user.role) {
      return;
    }

    const email = session.user.email;

    if (!email) {
      return;
    }

    try {
      const user = await this.userRepository.getUserByEmail(email);

      if (user) {
        session.user.role = user.role;
      }
    } catch (error) {
      // ignore enrichment failures to avoid breaking guard behaviour
    }
  }
}
