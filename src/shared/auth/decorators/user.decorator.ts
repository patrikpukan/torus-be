import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { Identity } from "../domain/identity";

export const User = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Identity | null => {
    const graphqlContext = GqlExecutionContext.create(ctx);
    const context = graphqlContext.getContext<{
      user?: Identity | null;
      req?: { user?: Identity | null };
    }>();

    return context.user ?? context.req?.user ?? null;
  }
);
