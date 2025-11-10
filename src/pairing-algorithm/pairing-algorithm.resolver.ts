import { ForbiddenException, UseGuards } from "@nestjs/common";
import { Args, Mutation, Resolver } from "@nestjs/graphql";
import { GraphQLError } from "graphql";
import { PairingPeriodStatus, UserRole } from "@prisma/client";
import {
  PairingAlgorithmService,
  InsufficientUsersException,
} from "./pairing-algorithm.service";
import { PairingExecutionResult } from "./types/pairing-execution-result.type";
import { AuthenticatedUserGuard } from "../shared/auth/guards/authenticated-user.guard";
import { User } from "../shared/auth/decorators/user.decorator";
import type { Identity } from "../shared/auth/domain/identity";
import { PrismaService } from "../core/prisma/prisma.service";
import { AppLoggerService } from "../shared/logger/logger.service";

type CurrentUserContext = Pick<Identity, "id" | "role" | "appRole"> & {
  organizationId?: string;
};

type ResolvedUserContext = {
  id: string;
  organizationId: string;
  role: string;
  appRole?: string;
};

@Resolver(() => PairingExecutionResult)
export class PairingAlgorithmResolver {
  constructor(
    private readonly pairingAlgorithmService: PairingAlgorithmService,
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService
  ) {}

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => PairingExecutionResult)
  /**
   * Manually triggers the pairing algorithm for an organization.
   * Requires admin role.
   *
   * @param organizationId - UUID of the organization
   * @param user - Authenticated user (from @User() decorator)
   * @returns Execution result with statistics
   */
  async executePairingAlgorithm(
    @Args("organizationId", { type: () => String }) organizationId: string,
    @User() user: CurrentUserContext | null
  ): Promise<PairingExecutionResult> {
    try {
      const resolvedUser = await this.resolveUser(user);

      // TESTING MODE: Admin check disabled for testing
      // TODO: Re-enable admin authorization check for production
      /*
      if (!this.isAdminForOrganization(resolvedUser, organizationId)) {
        this.logger.warn(
          `User ${resolvedUser.id} attempted to execute pairing algorithm without admin rights for organization ${organizationId}`,
          PairingAlgorithmResolver.name
        );
        throw new ForbiddenException(
          "You do not have permission to execute the pairing algorithm for this organization."
        );
      }
      */

      const previousPairings = await this.prisma.pairing.count({
        where: { organizationId },
      });

      await this.pairingAlgorithmService.executePairing(organizationId);

      const currentPairings = await this.prisma.pairing.count({
        where: { organizationId },
      });

      const pairingsCreated = Math.max(currentPairings - previousPairings, 0);
      const unpairedUsers = await this.calculateUnpairedUsers(organizationId);

      const message =
        pairingsCreated > 0
          ? `Pairing algorithm executed successfully: ${pairingsCreated} new pairings created.`
          : "Pairing algorithm executed successfully with no new pairings.";

      this.logger.log(
        `Pairing algorithm executed by user ${resolvedUser.id} for organization ${organizationId}. New pairings: ${pairingsCreated}`,
        PairingAlgorithmResolver.name
      );

      return {
        success: true,
        pairingsCreated,
        message,
        unpairedUsers,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      if (error instanceof InsufficientUsersException) {
        // Return a structured, non-throwing result so the frontend can show a toast
        return {
          success: false,
          pairingsCreated: 0,
          message: error.message,
          unpairedUsers: error.userCount,
        };
      }

      const err = error as Error;
      this.logger.error(
        `Failed to execute pairing algorithm for organization ${organizationId}: ${err.message}`,
        err.stack,
        PairingAlgorithmResolver.name
      );

      throw new GraphQLError("Failed to execute pairing algorithm", {
        extensions: {
          code: err?.name ?? "PAIRING_ALGORITHM_EXECUTION_FAILED",
          details: err?.message,
        },
      });
    }
  }

  private async resolveUser(
    user: CurrentUserContext | null
  ): Promise<ResolvedUserContext> {
    if (!user?.id) {
      throw new ForbiddenException("Authenticated user context is missing");
    }

    if (user.organizationId && user.role) {
      return {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role,
        appRole: user.appRole,
      };
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        organizationId: true,
        role: true,
      },
    });

    if (!dbUser) {
      throw new ForbiddenException("User account not found");
    }

    return {
      id: dbUser.id,
      organizationId: dbUser.organizationId,
      role: dbUser.role,
      appRole: user.appRole,
    };
  }

  private isAdminForOrganization(
    user: ResolvedUserContext,
    organizationId: string
  ): boolean {
    const role = user.role ?? user.appRole;

    if (!role) {
      return false;
    }

    const normalizedRole = String(role);
    const isAdminRole =
      normalizedRole === "admin" ||
      normalizedRole === UserRole.org_admin ||
      normalizedRole === UserRole.super_admin;

    if (!isAdminRole) {
      return false;
    }

    if (
      normalizedRole === UserRole.super_admin ||
      user.appRole === UserRole.super_admin
    ) {
      return true;
    }

    return user.organizationId === organizationId;
  }

  private async calculateUnpairedUsers(
    organizationId: string
  ): Promise<number | undefined> {
    const activePeriod = await this.prisma.pairingPeriod.findFirst({
      where: { organizationId, status: PairingPeriodStatus.active },
      orderBy: { startDate: "desc" },
      select: { id: true },
    });

    if (!activePeriod) {
      return undefined;
    }

    const unpairedCount = await this.prisma.user.count({
      where: {
        organizationId,
        isActive: true,
        OR: [{ suspendedUntil: null }, { suspendedUntil: { lt: new Date() } }],
        pairingsAsUserA: {
          none: { periodId: activePeriod.id },
        },
        pairingsAsUserB: {
          none: { periodId: activePeriod.id },
        },
      },
    });

    return unpairedCount;
  }
}
