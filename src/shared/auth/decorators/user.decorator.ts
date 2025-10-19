import {
  ContextType,
  createParamDecorator,
  ExecutionContext,
  NotImplementedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Identity } from '../domain/identity';

export const User = createParamDecorator(
  async (data: unknown, context: ExecutionContext): Promise<Identity> => {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest();
      return request.session.user;
    } else if (context.getType<ContextType | 'graphql'>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      return ctx.getContext().session.user;
    } else {
      throw new NotImplementedException(
        `Cannot retrieve user from ${context.getType()} context`,
      );
    }
  },
);
