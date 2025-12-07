import { join } from "path";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { ConfigModule } from "@applifting-io/nestjs-decorated-config";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { ForbiddenException, Logger, Module, UnauthorizedException } from "@nestjs/common";
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

const assertUserNotBanned = async (
  userId: string | null,
  prisma: PrismaService
): Promise<void> => {
  if (!userId) {
    return;
  }

  const activeBan = await prisma.ban.findFirst({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });

  if (activeBan) {
    throw new ForbiddenException("User account is banned");
  }
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
  let organizationId: string | undefined;
  let banCheckUserId: string | null = null;

  if (prisma) {
    try {
      const dbUser =
        supabaseUserId &&
        (await prisma.user.findFirst({
          where: { supabaseUserId },
          select: { id: true, role: true, organizationId: true },
        }));

      if (dbUser) {
        resolvedUserId = dbUser.id;
        appRole = dbUser.role ?? undefined;
        organizationId = dbUser.organizationId ?? undefined;
        banCheckUserId = dbUser.id;
      } else if (typeof claims.email === "string" && claims.email) {
        const fallbackUser = await prisma.user.findFirst({
          where: { email: claims.email },
          select: { id: true, role: true, supabaseUserId: true, organizationId: true },
        });

        if (fallbackUser) {
          resolvedUserId = fallbackUser.id;
          appRole = fallbackUser.role ?? undefined;
          organizationId = fallbackUser.organizationId ?? undefined;
          banCheckUserId = fallbackUser.id;
        }
      }
    } catch (error) {
      const err = error as Error;
      logger.warn(
        `Failed to resolve application user for Supabase identity: ${err.message}`
      );
    }
  }

  try {
    await assertUserNotBanned(banCheckUserId, prisma);
  } catch (error) {
    if (error instanceof ForbiddenException) {
      throw error;
    }

    const err = error as Error;
    logger.warn(
      `Failed to evaluate ban status for user ${banCheckUserId ?? "unknown"}: ${err.message}`
    );
  }

  // Ensure role and organizationId are always defined for authenticated users
  const role = appRole || (typeof claims.role === "string" ? claims.role : undefined);
  if (!role) {
    throw new UnauthorizedException("User role not found in claims or database");
  }

  if (!organizationId) {
    throw new UnauthorizedException("User organization not found in database");
  }

  return {
    id: resolvedUserId,
    supabaseUserId,
    email: typeof claims.email === "string" ? claims.email : undefined,
    role,
    appRole,
    organizationId,
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
                if (error instanceof ForbiddenException) {
                  throw error;
                }

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
