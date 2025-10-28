import { BadRequestException, ForbiddenException, UseGuards } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { UserRole } from "@prisma/client";
import { AlgorithmSettingsResponse, AlgorithmSettingsType } from "./types/algorithm-settings.type";
import { UpdateAlgorithmSettingsInput } from "./types/update-algorithm-settings.input";
import { AuthenticatedUserGuard } from "../shared/auth/guards/authenticated-user.guard";
import { User } from "../shared/auth/decorators/user.decorator";
import type { Identity } from "../shared/auth/domain/identity";
import { PrismaService } from "../core/prisma/prisma.service";
import { AppLoggerService } from "../shared/logger/logger.service";
import { PairingAlgorithmConfig } from "./pairing-algorithm.config";

type UserContext = Pick<Identity, "id" | "role" | "appRole"> & {
  organizationId?: string;
};

type ResolvedUser = {
  id: string;
  organizationId: string;
  role: string;
  appRole?: string;
};

@Resolver(() => AlgorithmSettingsType)
export class AlgorithmSettingsResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
    private readonly pairingConfig: PairingAlgorithmConfig
  ) {}

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => AlgorithmSettingsResponse)
  async updateAlgorithmSettings(
    @Args("input") input: UpdateAlgorithmSettingsInput,
    @User() user: UserContext | null
  ): Promise<AlgorithmSettingsResponse> {
    const resolvedUser = await this.resolveUser(user);
    this.assertAdminAccess(resolvedUser, input.organizationId);

    const existingSettings = await this.prisma.algorithmSetting.findUnique({
      where: { organizationId: input.organizationId },
    });

    const periodLengthDays = this.resolvePeriodLengthDays(
      input.periodLengthDays,
      existingSettings?.periodLengthDays
    );
    const randomSeed = this.resolveRandomSeed(
      input.randomSeed,
      existingSettings?.randomSeed
    );

    const warning = this.buildWarning(periodLengthDays);

    const settings = existingSettings
      ? await this.prisma.algorithmSetting.update({
          where: { organizationId: input.organizationId },
          data: {
            periodLengthDays,
            randomSeed,
          },
        })
      : await this.prisma.algorithmSetting.create({
          data: {
            organizationId: input.organizationId,
            periodLengthDays,
            randomSeed,
          },
        });

    this.logger.log(
      `Algorithm settings updated for organization ${input.organizationId} by user ${resolvedUser.id}`,
      AlgorithmSettingsResolver.name
    );

    return {
      id: settings.id,
      organizationId: settings.organizationId,
      periodLengthDays,
      randomSeed,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
      warning,
    };
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => AlgorithmSettingsType)
  async getAlgorithmSettings(
    @Args("organizationId") organizationId: string,
    @User() user: UserContext | null
  ): Promise<AlgorithmSettingsType> {
    const resolvedUser = await this.resolveUser(user);
    this.assertAdminAccess(resolvedUser, organizationId);

    const existingSettings = await this.prisma.algorithmSetting.findUnique({
      where: { organizationId },
    });

    if (!existingSettings) {
      const randomSeed = this.resolveRandomSeed(undefined, null);
      const created = await this.prisma.algorithmSetting.create({
        data: {
          organizationId,
          periodLengthDays: this.pairingConfig.defaultPeriodDays,
          randomSeed,
        },
      });

      return {
        id: created.id,
        organizationId: created.organizationId,
        periodLengthDays: this.pairingConfig.defaultPeriodDays,
        randomSeed,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    }

    const periodLengthDays = this.resolvePeriodLengthDays(
      undefined,
      existingSettings.periodLengthDays
    );
    const randomSeed = this.resolveRandomSeed(undefined, existingSettings.randomSeed);

    if (
      periodLengthDays !== existingSettings.periodLengthDays ||
      randomSeed !== existingSettings.randomSeed
    ) {
      const updated = await this.prisma.algorithmSetting.update({
        where: { organizationId },
        data: {
          periodLengthDays,
          randomSeed,
        },
      });

      return {
        id: updated.id,
        organizationId: updated.organizationId,
        periodLengthDays,
        randomSeed,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    }

    return {
      id: existingSettings.id,
      organizationId: existingSettings.organizationId,
      periodLengthDays,
      randomSeed,
      createdAt: existingSettings.createdAt,
      updatedAt: existingSettings.updatedAt,
    };
  }

  private async resolveUser(user: UserContext | null): Promise<ResolvedUser> {
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

  private assertAdminAccess(user: ResolvedUser, organizationId: string): void {
    const role = user.role ?? user.appRole;

    if (!role) {
      throw new ForbiddenException("Insufficient permissions");
    }

    const normalizedRole = String(role);
    const isAdminRole =
      normalizedRole === "admin" ||
      normalizedRole === UserRole.org_admin ||
      normalizedRole === UserRole.super_admin;

    if (!isAdminRole) {
      throw new ForbiddenException("Insufficient permissions");
    }

    if (
      normalizedRole !== UserRole.super_admin &&
      user.appRole !== UserRole.super_admin &&
      user.organizationId !== organizationId
    ) {
      throw new ForbiddenException("Insufficient permissions");
    }
  }

  private resolvePeriodLengthDays(
  input: number | null | undefined,
  fallback?: number | null
  ): number {
  const value = input ?? fallback ?? this.pairingConfig.defaultPeriodDays;

    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException("periodLengthDays must be a positive integer");
    }

    return value;
  }

  private resolveRandomSeed(
    input: number | null | undefined,
  fallback?: number | null
  ): number {
    if (input == null) {
      const fallbackSeed = fallback ?? Math.abs(Date.now());

      if (!Number.isInteger(fallbackSeed) || fallbackSeed <= 0) {
        throw new BadRequestException("randomSeed must be a positive integer");
      }

      return fallbackSeed;
    }

    if (!Number.isInteger(input) || input <= 0) {
      throw new BadRequestException("randomSeed must be a positive integer");
    }

    return input;
  }

  private buildWarning(periodLengthDays: number): string | null {
    if (periodLengthDays < this.pairingConfig.minPeriodDays) {
      return `Warning: Period length is too short (< ${this.pairingConfig.minPeriodDays} days)`;
    }

    if (periodLengthDays > this.pairingConfig.maxPeriodDays) {
      return `Warning: Period length is too long (> ${this.pairingConfig.maxPeriodDays} days)`;
    }

    return null;
  }
}
