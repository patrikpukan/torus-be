import { BadRequestException, Injectable } from "@nestjs/common";
import { randomInt } from "crypto";
import { PrismaService } from "../../../core/prisma/prisma.service";
import { AppLoggerService } from "../../../shared/logger/logger.service";
import {
  UserContextService,
  ResolvedUser,
} from "../../../shared/auth/services/user-context.service";
import { PairingAlgorithmConfig } from "../pairing-algorithm.config";
import { UpdateAlgorithmSettingsInput } from "../types/update-algorithm-settings.input";
import {
  AlgorithmSettingsResponse,
  AlgorithmSettingsType,
} from "../types/algorithm-settings.type";

@Injectable()
export class AlgorithmSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
    private readonly userContextService: UserContextService,
    private readonly pairingConfig: PairingAlgorithmConfig
  ) {}

  async updateSettings(
    input: UpdateAlgorithmSettingsInput,
    user: ResolvedUser
  ): Promise<AlgorithmSettingsResponse> {
    this.assertAdminAccess(user, input.organizationId);

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
      `Algorithm settings updated for organization ${input.organizationId} by user ${user.id}`,
      AlgorithmSettingsService.name
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

  async getOrCreateSettings(
    organizationId: string
  ): Promise<AlgorithmSettingsType> {
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
    const randomSeed = this.resolveRandomSeed(
      undefined,
      existingSettings.randomSeed
    );

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

  private assertAdminAccess(user: ResolvedUser, organizationId: string): void {
    this.userContextService.validateAdminAccessToOrg(user, organizationId);
  }

  private resolvePeriodLengthDays(
    input: number | null | undefined,
    fallback?: number | null
  ): number {
    const value = input ?? fallback ?? this.pairingConfig.defaultPeriodDays;

    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(
        "periodLengthDays must be a positive integer"
      );
    }

    return value;
  }

  private resolveRandomSeed(
    input: number | null | undefined,
    fallback?: number | null
  ): number {
    const minSeed = 1;
    const maxSeed = 2_147_483_647; // INT4 max value

    const candidate = input ?? fallback;

    if (candidate != null) {
      if (
        !Number.isInteger(candidate) ||
        candidate < minSeed ||
        candidate > maxSeed
      ) {
        throw new BadRequestException(
          `randomSeed must be an integer between ${minSeed} and ${maxSeed}`
        );
      }

      return candidate;
    }

    // randomInt upper bound is exclusive, so we use maxSeed (not maxSeed + 1) to stay within INT4 range
    return randomInt(minSeed, maxSeed);
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
