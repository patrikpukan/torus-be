import { join } from "path";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { ConfigModule } from "@applifting-io/nestjs-decorated-config";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { Logger, Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import type { Request, Response } from "express";
import { verifySupabaseJwt } from "../../auth/verifySupabaseJwt";
import { Identity } from "../auth/domain/identity";
import { Config } from "../config/config.service";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { PrismaService } from "../../core/prisma/prisma.service";

const logger = new Logger("GraphqlSetupModule");

interface GraphQLContextShape {
  req: Request & { user?: Identity | null };
  res: Response;
  user: Identity | null;
}

const extractBearerToken = (
  value?: string | string[] | null
): string | null => {
  if (!value) {
    return null;
  }

  const header = Array.isArray(value) && value.length > 0 ? value[0] : value;

  if (typeof header !== "string") {
    return null;
  }

  const trimmed = header.trim();

  if (!trimmed) {
    return null;
  }

  const lowerCased = trimmed.toLowerCase();

  return lowerCased.startsWith("bearer ") ? trimmed.slice(7).trim() : trimmed;
};

const buildIdentity = async (
  token: string,
  secret: string | undefined,
  prisma: PrismaService
): Promise<Identity | null> => {
  if (!token || !secret) {
    return null;
  }

  const claims = verifySupabaseJwt(token, secret);
  const supabaseUserId = claims.sub;
  let resolvedUserId = supabaseUserId;
  let appRole: string | undefined;

  if (prisma) {
    try {
      const dbUser =
        supabaseUserId &&
        (await prisma.user.findFirst({
          where: { supabaseUserId },
          select: { id: true, role: true },
        }));

      if (dbUser) {
        resolvedUserId = dbUser.id;
        appRole = dbUser.role ?? undefined;
      } else if (typeof claims.email === "string" && claims.email) {
        const fallbackUser = await prisma.user.findFirst({
          where: { email: claims.email },
          select: { id: true, role: true, supabaseUserId: true },
        });

        if (fallbackUser) {
          resolvedUserId = fallbackUser.id;
          appRole = fallbackUser.role ?? undefined;
        }
      }
    } catch (error) {
      const err = error as Error;
      logger.warn(
        `Failed to resolve application user for Supabase identity: ${err.message}`
      );
    }
  }

  return {
    id: resolvedUserId,
    supabaseUserId,
    email: typeof claims.email === "string" ? claims.email : undefined,
    role: typeof claims.role === "string" ? claims.role : undefined,
    appRole,
    rawClaims: claims,
    metadata:
      typeof claims.user_metadata === "object" && claims.user_metadata !== null
        ? (claims.user_metadata as Record<string, unknown>)
        : undefined,
  };
};

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    GraphQLModule.forRootAsync({
      driver: ApolloDriver,
      imports: [ConfigModule, PrismaModule],
      inject: [Config, PrismaService],
      useFactory: (config: Config, prisma: PrismaService): ApolloDriverConfig => {
        return {
          autoSchemaFile: join(process.cwd(), "src/schema.gql"),
          sortSchema: true,
          playground: false,
          introspection: true,
          context: async (ctx): Promise<GraphQLContextShape> => {
            const { req, res } = ctx as {
              req: Request;
              res: Response;
            };
            const request = req as GraphQLContextShape["req"];
            let identity: Identity | null = null;

            const headerToken = extractBearerToken(
              request.headers?.authorization ?? request.headers?.Authorization
            );
            const token = headerToken ?? null;

            if (token) {
              try {
                identity = await buildIdentity(
                  token,
                  config.supabaseJwtSecret,
                  prisma
                );
              } catch (error) {
                const err = error as Error;
                logger.warn(
                  `Failed to verify Supabase JWT: ${err.message}`,
                  err.stack
                );
                identity = null;
              }
            }

            request.user = identity;

            return {
              req: request,
              res,
              user: identity,
            };
          },
          plugins: [
            ApolloServerPluginLandingPageLocalDefault({
              includeCookies: true,
              embed: true,
            }),
          ],
        };
      },
    }),
  ],
})
export class GraphqlSetupModule {}
