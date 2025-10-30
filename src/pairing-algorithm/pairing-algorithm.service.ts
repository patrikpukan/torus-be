import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PairingPeriodStatus, PairingStatus, User } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../core/prisma/prisma.service';
import { AppLoggerService } from '../shared/logger/logger.service';
import { PairingAlgorithmConfig } from './pairing-algorithm.config';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;

    if (this.seed <= 0) {
      this.seed += 2147483646;
    }
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed;
  }

  nextFloat(): number {
    return (this.next() - 1) / 2147483646;
  }
}

const buildPairKey = (userAId: string, userBId: string): string => {
  return userAId < userBId
    ? `${userAId}:${userBId}`
    : `${userBId}:${userAId}`;
};

const pairingDefaults = new PairingAlgorithmConfig();
const pairingCronSchedule = pairingDefaults.cronSchedule;
const pairingCronDisabled = !pairingDefaults.cronEnabled;

export class AlgorithmSettingsNotFoundException extends Error {
  constructor(public readonly organizationId: string) {
    super(`Algorithm settings not found for organization ${organizationId}`);
    this.name = AlgorithmSettingsNotFoundException.name;
  }
}

export class InsufficientUsersException extends Error {
  constructor(public readonly organizationId: string, public readonly userCount: number) {
    super(`Not enough users to create pairings for organization ${organizationId}`);
    this.name = InsufficientUsersException.name;
  }
}

export class PairingConstraintException extends Error {
  constructor(message: string, public readonly metadata?: Record<string, unknown>) {
    super(message);
    this.name = PairingConstraintException.name;
  }
}

@Injectable()
export class PairingAlgorithmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
    private readonly config: PairingAlgorithmConfig,
  ) {}

  /**
   * Scheduled task that processes all organizations with ended periods.
   * Runs via cron job (configurable via PAIRING_CRON_SCHEDULE).
   *
   * @returns Promise<void>
   */
  @Cron(pairingCronSchedule, {
    name: 'executeScheduledPairing',
    disabled: pairingCronDisabled,
  })
  async executeScheduledPairing(): Promise<void> {
    const configuredOrganizations = await this.prisma.algorithmSetting.findMany({
      select: { organizationId: true },
    });

    const organizationIds = Array.from(
      new Set(configuredOrganizations.map((setting) => setting.organizationId)),
    );

    const summary = {
      processed: organizationIds.length,
      successes: 0,
      skipped: 0,
      failures: 0,
      totalPairs: 0,
    };

    if (organizationIds.length === 0) {
      this.logger.debug(
        'Scheduled pairing cron found no organizations with configured algorithm settings',
        PairingAlgorithmService.name,
      );
      this.logger.log(
        `Scheduled pairing summary | processed=${summary.processed} successes=${summary.successes} skipped=${summary.skipped} failures=${summary.failures} pairsCreated=${summary.totalPairs}`,
        PairingAlgorithmService.name,
      );
      return;
    }

    const failures: Array<{ organizationId: string; reason: string }> = [];

    for (const organizationId of organizationIds) {
      try {
        const activePeriod = await this.prisma.pairingPeriod.findFirst({
          where: { organizationId, status: PairingPeriodStatus.active },
          orderBy: { startDate: 'desc' },
        });

        const now = new Date();

        if (!activePeriod) {
          this.logger.debug(
            `No active pairing period for organization ${organizationId}; executing pairing to bootstrap`,
            PairingAlgorithmService.name,
          );
        } else if (!activePeriod.endDate) {
          this.logger.warn(
            `Active pairing period ${activePeriod.id} for organization ${organizationId} has no end date; skipping`,
            PairingAlgorithmService.name,
          );
          summary.skipped += 1;
          continue;
        } else if (activePeriod.endDate <= now) {
          await this.prisma.pairingPeriod.update({
            where: { id: activePeriod.id },
            data: { status: PairingPeriodStatus.closed },
          });
          this.logger.debug(
            `Closed pairing period ${activePeriod.id} for organization ${organizationId}; generating new pairings`,
            PairingAlgorithmService.name,
          );
        } else {
          this.logger.debug(
            `Active pairing period ${activePeriod.id} for organization ${organizationId} still in progress; skipping`,
            PairingAlgorithmService.name,
          );
          summary.skipped += 1;
          continue;
        }

        const beforeCount = await this.prisma.pairing.count({
          where: { organizationId },
        });

        await this.executePairing(organizationId);

        const afterCount = await this.prisma.pairing.count({
          where: { organizationId },
        });

        const created = Math.max(afterCount - beforeCount, 0);
        summary.totalPairs += created;
        summary.successes += 1;
      } catch (error) {
        summary.failures += 1;
        const err = error as Error;
        failures.push({ organizationId, reason: err.message });
        this.logger.error(
          `Scheduled pairing failed for organization ${organizationId}: ${err.message}`,
          err.stack,
          PairingAlgorithmService.name,
        );
      }
    }

    this.logger.log(
      `Scheduled pairing summary | processed=${summary.processed} successes=${summary.successes} skipped=${summary.skipped} failures=${summary.failures} pairsCreated=${summary.totalPairs}`,
      PairingAlgorithmService.name,
    );

    if (failures.length > 0) {
      const details = failures
        .map((failure) => `${failure.organizationId}: ${failure.reason}`)
        .join('; ');
      this.logger.warn(
        `Scheduled pairing encountered failures: ${details}`,
        PairingAlgorithmService.name,
      );
    }
  }

  /**
   * Executes the pairing algorithm for a given organization.
   * Creates pairs for the current active period, respecting all constraints.
   *
   * @param organizationId - UUID of the organization
   * @throws {AlgorithmSettingsNotFoundException} When settings not configured
   * @throws {InsufficientUsersException} When less than 2 users available
   * @throws {PairingConstraintException} When constraints cannot be satisfied
   * @returns Promise<void>
   */
  async executePairing(organizationId: string): Promise<void> {
    let pairingPeriodId: string | undefined;
    let totalEligibleUsers = 0;
    let guaranteedUserIds: string[] = [];

    try {
      this.logger.log(
        `Pairing algorithm started for organization: ${organizationId}`,
        PairingAlgorithmService.name,
      );

      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });

      if (!organization) {
        throw new PairingConstraintException('Organization not found', { organizationId });
      }

      let algorithmSettings = await this.prisma.algorithmSetting.findUnique({
        where: { organizationId },
      });

      if (!algorithmSettings) {
        this.logger.warn(
          `Algorithm settings missing for organization ${organizationId}, creating defaults`,
          PairingAlgorithmService.name,
        );

        algorithmSettings = await this.prisma.algorithmSetting.create({
          data: {
            organizationId,
            periodLengthDays: this.config.defaultPeriodDays,
            randomSeed: randomInt(-2147483648, 2147483647),
          },
        });
      }

      if (!algorithmSettings) {
        throw new PairingConstraintException('Failed to initialize algorithm settings', {
          organizationId,
        });
      }

      if (!algorithmSettings.periodLengthDays || algorithmSettings.periodLengthDays <= 0) {
        throw new PairingConstraintException('Pairing period length must be positive', {
          organizationId,
          periodLengthDays: algorithmSettings.periodLengthDays,
        });
      }

      if (!algorithmSettings.randomSeed || algorithmSettings.randomSeed <= 0) {
        algorithmSettings = await this.prisma.algorithmSetting.update({
          where: { organizationId },
          data: { randomSeed: randomInt(-2147483648, 2147483647) },
        });
      }

      const periodLengthDays =
        algorithmSettings.periodLengthDays ?? this.config.defaultPeriodDays;
      const periodLengthWarning = this.validatePeriodLength(periodLengthDays);

      if (periodLengthWarning) {
        this.logger.warn(periodLengthWarning, PairingAlgorithmService.name);
      }

      let pairingPeriod = await this.prisma.pairingPeriod.findFirst({
        where: {
          organizationId,
          status: PairingPeriodStatus.active,
        },
        orderBy: { startDate: 'desc' },
      });

      if (!pairingPeriod) {
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + periodLengthDays * MILLISECONDS_PER_DAY);

        if (endDate <= startDate) {
          throw new PairingConstraintException(
            'Invalid pairing period configuration',
            { organizationId, periodLengthDays },
          );
        }

        pairingPeriod = await this.prisma.pairingPeriod.create({
          data: {
            organizationId,
            status: PairingPeriodStatus.active,
            startDate,
            endDate,
          },
        });
      }

      pairingPeriodId = pairingPeriod.id;

      const eligibleUsers = await this.getEligibleUsers(organizationId, pairingPeriod.id);

      totalEligibleUsers = eligibleUsers.length;

      const [newUserIds, unpairedUserIds] = await Promise.all([
        this.getNewUsers(organizationId),
        this.getUnpairedFromLastPeriod(organizationId, pairingPeriod.id),
      ]);

      guaranteedUserIds = Array.from(new Set<string>([...newUserIds, ...unpairedUserIds]));

      const random = new SeededRandom(algorithmSettings.randomSeed ?? Date.now());

      if (totalEligibleUsers < 2) {
        throw new InsufficientUsersException(organizationId, totalEligibleUsers);
      }

      if (totalEligibleUsers % 2 !== 0) {
        this.logger.warn(
          `Odd number of users, one will remain unpaired (eligible count: ${totalEligibleUsers})`,
          PairingAlgorithmService.name,
        );
      }

      const guaranteedSet = new Set(guaranteedUserIds);
      const guaranteedUsers = eligibleUsers.filter((user) => guaranteedSet.has(user.id));
      const regularUsers = eligibleUsers.filter((user) => !guaranteedSet.has(user.id));

      this.shuffleInPlace(guaranteedUsers, random);
      this.shuffleInPlace(regularUsers, random);

      const userHistories = new Map<string, Map<string, number>>();
      const userBlocks = new Map<string, Set<string>>();

      await Promise.all(
        eligibleUsers.map(async (user) => {
          const [history, blocks] = await Promise.all([
            this.getUserPairingHistory(user.id, organizationId),
            this.getUserBlocks(user.id),
          ]);

          userHistories.set(user.id, history);
          userBlocks.set(user.id, blocks);
        }),
      );

      const previousPeriods = await this.prisma.pairingPeriod.findMany({
        where: {
          organizationId,
          id: { not: pairingPeriod.id },
        },
        orderBy: { createdAt: 'desc' },
        take: 2,
      });

      const lastPeriodId = previousPeriods[0]?.id ?? null;
      const secondLastPeriodId = previousPeriods[1]?.id ?? null;

      const [lastPeriodPairs, secondLastPeriodPairs] = await Promise.all([
        lastPeriodId
          ? this.prisma.pairing.findMany({
              where: { organizationId, periodId: lastPeriodId },
              select: { userAId: true, userBId: true },
            })
          : Promise.resolve([]),
        secondLastPeriodId
          ? this.prisma.pairing.findMany({
              where: { organizationId, periodId: secondLastPeriodId },
              select: { userAId: true, userBId: true },
            })
          : Promise.resolve([]),
      ]);

      const lastPeriodPairKeys = new Set(
        lastPeriodPairs.map((pair) => buildPairKey(pair.userAId, pair.userBId)),
      );
      const secondLastPeriodPairKeys = new Set(
        secondLastPeriodPairs.map((pair) => buildPairKey(pair.userAId, pair.userBId)),
      );

      const availableUsers = new Set(eligibleUsers.map((user) => user.id));
      const unpairedUsers = new Set<string>();
      const pairs: Array<{ userAId: string; userBId: string }> = [];

      const tryPairUser = (userId: string): void => {
        if (!availableUsers.has(userId)) {
          return;
        }

        const blocksA = userBlocks.get(userId) ?? new Set<string>();
        const historyA = userHistories.get(userId) ?? new Map<string, number>();

        const potentialPartners = Array.from(availableUsers).filter(
          (candidateId) => candidateId !== userId,
        );

        this.logger.debug(
          `Evaluating partners for ${userId}. Available: ${potentialPartners.join(', ')}`,
          PairingAlgorithmService.name,
        );

        if (potentialPartners.length === 0) {
          this.logger.warn(
            `No partners available for ${userId}; marking as unpaired`,
            PairingAlgorithmService.name,
          );
          unpairedUsers.add(userId);
          availableUsers.delete(userId);
          return;
        }

        const candidateInfos = potentialPartners
          .map((candidateId) => {
            const partnerBlocks = userBlocks.get(candidateId) ?? new Set<string>();
            const partnerHistory =
              userHistories.get(candidateId) ?? new Map<string, number>();

            const isBlocked =
              blocksA.has(candidateId) || partnerBlocks.has(userId);

            return {
              candidateId,
              partnerBlocks,
              partnerHistory,
              isBlocked,
            };
          })
          .filter((info) => !info.isBlocked);

        if (candidateInfos.length === 0) {
          this.logger.error(
            `No available partners for user ${userId} due to blocking relationships`,
            PairingAlgorithmService.name,
          );
          unpairedUsers.add(userId);
          availableUsers.delete(userId);
          return;
        }

        const preferredCandidates = candidateInfos.filter((info) =>
          this.canBePaired(
            userId,
            info.candidateId,
            blocksA,
            info.partnerBlocks,
            historyA,
            info.partnerHistory,
            totalEligibleUsers,
          ),
        );

        const selectionPool =
          preferredCandidates.length > 0 ? preferredCandidates : candidateInfos;

        this.shuffleInPlace(selectionPool, random);

        const selected = selectionPool[0];

        if (!selected) {
          this.logger.warn(
            `Unable to select partner for ${userId}; marking as unpaired`,
            PairingAlgorithmService.name,
          );
          unpairedUsers.add(userId);
          availableUsers.delete(userId);
          return;
        }

        availableUsers.delete(userId);
        availableUsers.delete(selected.candidateId);

        this.logger.debug(
          `Pairing ${userId} with ${selected.candidateId}`,
          PairingAlgorithmService.name,
        );

        pairs.push({ userAId: userId, userBId: selected.candidateId });
      };

      guaranteedUsers.forEach((user) => tryPairUser(user.id));
      regularUsers.forEach((user) => tryPairUser(user.id));

      Array.from(availableUsers).forEach((remainingUserId) => {
        unpairedUsers.add(remainingUserId);
      });

      const avoidLastPeriod = (pair: { userAId: string; userBId: string }): boolean => {
        return !lastPeriodPairKeys.has(buildPairKey(pair.userAId, pair.userBId));
      };

      const avoidThreePeat = (pair: { userAId: string; userBId: string }): boolean => {
        const key = buildPairKey(pair.userAId, pair.userBId);
        return !(lastPeriodPairKeys.has(key) && secondLastPeriodPairKeys.has(key));
      };

      pairs.forEach((pair, index) => {
        const key = buildPairKey(pair.userAId, pair.userBId);
        if (lastPeriodPairKeys.has(key)) {
          this.logger.warn(
            `Pair (${pair.userAId}, ${pair.userBId}) was also paired in last period`,
            PairingAlgorithmService.name,
          );

          if (!this.trySwapPairs(
            pairs,
            index,
            userBlocks,
            userHistories,
            totalEligibleUsers,
            avoidLastPeriod,
          )) {
            this.logger.warn(
              `Unable to swap pair (${pair.userAId}, ${pair.userBId}) to avoid repeat`,
              PairingAlgorithmService.name,
            );
          }
        }
      });

      if (totalEligibleUsers > 2) {
        pairs.forEach((pair, index) => {
          const key = buildPairKey(pair.userAId, pair.userBId);
          if (
            lastPeriodPairKeys.has(key) &&
            secondLastPeriodPairKeys.has(key)
          ) {
            if (!this.trySwapPairs(
              pairs,
              index,
              userBlocks,
              userHistories,
              totalEligibleUsers,
              avoidThreePeat,
            )) {
              throw new PairingConstraintException(
                'Unable to avoid three consecutive pairings',
                { userAId: pair.userAId, userBId: pair.userBId },
              );
            }
          }
        });
      }

      await this.prisma.$transaction(async (tx) => {
        if (pairs.length > 0) {
          const now = new Date();
          await tx.pairing.createMany({
            data: pairs.map((pair) => ({
              periodId: pairingPeriod.id,
              organizationId,
              userAId: pair.userAId,
              userBId: pair.userBId,
              status: PairingStatus.planned,
              createdAt: now,
            })),
          });
        }
      });

      const guaranteedPairedUsers = new Set<string>();
      const regularPairedUsers = new Set<string>();

      pairs.forEach((pair) => {
        if (guaranteedSet.has(pair.userAId)) {
          guaranteedPairedUsers.add(pair.userAId);
        } else {
          regularPairedUsers.add(pair.userAId);
        }

        if (guaranteedSet.has(pair.userBId)) {
          guaranteedPairedUsers.add(pair.userBId);
        } else {
          regularPairedUsers.add(pair.userBId);
        }
      });

      this.logger.log(
        `Created ${pairs.length} pairs for organization ${organizationId}`,
        PairingAlgorithmService.name,
      );
      this.logger.log(
        `Guaranteed users paired: ${guaranteedPairedUsers.size}`,
        PairingAlgorithmService.name,
      );
      this.logger.log(
        `Regular users paired: ${regularPairedUsers.size}`,
        PairingAlgorithmService.name,
      );
      this.logger.log(
        `Unpaired users: ${unpairedUsers.size}`,
        PairingAlgorithmService.name,
      );

      if (unpairedUsers.size > 0) {
        this.logger.debug(
          `Unpaired user IDs: ${Array.from(unpairedUsers).join(', ')}`,
          PairingAlgorithmService.name,
        );
      }

      if (pairs.length === 0) {
        this.logger.warn(
          'No pairs were created during this run',
          PairingAlgorithmService.name,
        );
      }

      this.logger.log(
        `Pairing algorithm completed for organization ${organizationId}`,
        PairingAlgorithmService.name,
      );
    } catch (error) {
      const context = {
        organizationId,
        pairingPeriodId,
        totalEligibleUsers,
        guaranteedUserCount: guaranteedUserIds.length,
      };

      this.logger.error(
        `Pairing algorithm failed: ${(error as Error).message}. Context: ${JSON.stringify(context)}`,
        (error as Error).stack,
        PairingAlgorithmService.name,
      );

      throw error;
    }
  }

  private validatePeriodLength(days: number): string | null {
    if (days < this.config.minPeriodDays) {
      return `Period length is too short (< ${this.config.minPeriodDays} days). Users may not have enough time to meet.`;
    }
    if (days > this.config.maxPeriodDays) {
      return `Period length is too long (> ${this.config.maxPeriodDays} days). Engagement may decrease over time.`;
    }
    return null;
  }

  private shuffleInPlace<T>(items: T[], random: SeededRandom): void {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random.nextFloat() * (index + 1));

      if (swapIndex !== index) {
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
      }
    }
  }

  private trySwapPairs(
    pairs: Array<{ userAId: string; userBId: string }>,
    targetIndex: number,
    userBlocks: Map<string, Set<string>>,
    userHistories: Map<string, Map<string, number>>,
    totalEligibleUsers: number,
    avoidPredicate: (pair: { userAId: string; userBId: string }) => boolean,
  ): boolean {
    const targetPair = pairs[targetIndex];

    if (!targetPair) {
      return false;
    }

    for (let index = 0; index < pairs.length; index += 1) {
      if (index === targetIndex) {
        continue;
      }

      const candidatePair = pairs[index];

      const swapConfigurations: Array<{
        first: [string, string];
        second: [string, string];
      }> = [
        {
          first: [targetPair.userAId, candidatePair.userAId],
          second: [targetPair.userBId, candidatePair.userBId],
        },
        {
          first: [targetPair.userAId, candidatePair.userBId],
          second: [targetPair.userBId, candidatePair.userAId],
        },
        {
          first: [targetPair.userBId, candidatePair.userAId],
          second: [targetPair.userAId, candidatePair.userBId],
        },
        {
          first: [targetPair.userBId, candidatePair.userBId],
          second: [targetPair.userAId, candidatePair.userAId],
        },
      ];

      for (const configuration of swapConfigurations) {
        const [firstA, firstB] = configuration.first;
        const [secondA, secondB] = configuration.second;

        if (
          firstA === firstB ||
          secondA === secondB ||
          new Set([firstA, firstB, secondA, secondB]).size !== 4
        ) {
          continue;
        }

        const proposedFirst = { userAId: firstA, userBId: firstB };
        const proposedSecond = { userAId: secondA, userBId: secondB };

        if (
          !avoidPredicate(proposedFirst) ||
          !avoidPredicate(proposedSecond) ||
          !this.isPairValid(
            proposedFirst,
            userBlocks,
            userHistories,
            totalEligibleUsers,
          ) ||
          !this.isPairValid(
            proposedSecond,
            userBlocks,
            userHistories,
            totalEligibleUsers,
          )
        ) {
          continue;
        }

        pairs[targetIndex] = proposedFirst;
        pairs[index] = proposedSecond;
        return true;
      }
    }

    return false;
  }

  private isPairValid(
    pair: { userAId: string; userBId: string },
    userBlocks: Map<string, Set<string>>,
    userHistories: Map<string, Map<string, number>>,
    totalEligibleUsers: number,
  ): boolean {
    const blocksA = userBlocks.get(pair.userAId) ?? new Set<string>();
    const blocksB = userBlocks.get(pair.userBId) ?? new Set<string>();

    if (blocksA.has(pair.userBId) || blocksB.has(pair.userAId)) {
      return false;
    }

    return this.canBePaired(
      pair.userAId,
      pair.userBId,
      blocksA,
      blocksB,
      userHistories.get(pair.userAId) ?? new Map<string, number>(),
      userHistories.get(pair.userBId) ?? new Map<string, number>(),
      totalEligibleUsers,
    );
  }

  private async getEligibleUsers(
    organizationId: string,
    periodId: string,
  ): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { suspendedUntil: null },
          { suspendedUntil: { lt: new Date() } },
        ],
        pairingsAsUserA: {
          none: { periodId },
        },
        pairingsAsUserB: {
          none: { periodId },
        },
      },
    });
  }

  private async getNewUsers(organizationId: string): Promise<string[]> {
    const newUsers = await this.prisma.user.findMany({
      select: { id: true },
      where: {
        organizationId,
        pairingsAsUserA: { none: {} },
        pairingsAsUserB: { none: {} },
      },
    });

    return newUsers.map((user) => user.id);
  }

  private async getUnpairedFromLastPeriod(
    organizationId: string,
    currentPeriodId: string,
  ): Promise<string[]> {
    const currentPeriod = await this.prisma.pairingPeriod.findUnique({
      select: { startDate: true },
      where: { id: currentPeriodId },
    });

    if (!currentPeriod?.startDate) {
      return [];
    }

    const previousPeriod = await this.prisma.pairingPeriod.findFirst({
      select: { id: true },
      where: {
        organizationId,
        startDate: { lt: currentPeriod.startDate },
      },
      orderBy: { startDate: 'desc' },
    });

    if (!previousPeriod) {
      return [];
    }

    const eligibleUsers = await this.getEligibleUsers(
      organizationId,
      previousPeriod.id,
    );

    const pairedUsers = await this.prisma.pairing.findMany({
      select: {
        userAId: true,
        userBId: true,
      },
      where: {
        organizationId,
        periodId: previousPeriod.id,
      },
    });

    const pairedUserIds = new Set<string>();
    pairedUsers.forEach((pairing) => {
      pairedUserIds.add(pairing.userAId);
      pairedUserIds.add(pairing.userBId);
    });

    return eligibleUsers
      .map((user) => user.id)
      .filter((userId) => !pairedUserIds.has(userId));
  }

  private async getUserPairingHistory(
    userId: string,
    organizationId: string,
    limitPeriods: number = 2,
  ): Promise<Map<string, number>> {
    const recentPeriods = await this.prisma.pairingPeriod.findMany({
      select: { id: true },
      where: {
        organizationId,
      },
      orderBy: { startDate: 'desc' },
      take: limitPeriods,
    });

    if (recentPeriods.length === 0) {
      return new Map();
    }

    const periodIds = recentPeriods.map((period) => period.id);

    const pairings = await this.prisma.pairing.findMany({
      select: {
        userAId: true,
        userBId: true,
      },
      where: {
        organizationId,
        periodId: { in: periodIds },
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    });

    const history = new Map<string, number>();

    pairings.forEach((pairing) => {
      const partnerId = pairing.userAId === userId ? pairing.userBId : pairing.userAId;
      history.set(partnerId, (history.get(partnerId) ?? 0) + 1);
    });

    return history;
  }

  private async getUserBlocks(userId: string): Promise<Set<string>> {
    const blocks = await this.prisma.userBlock.findMany({
      select: {
        blockerId: true,
        blockedId: true,
      },
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
    });

    const blockSet = new Set<string>();
    blocks.forEach((block) => {
      if (block.blockerId !== userId) {
        blockSet.add(block.blockerId);
      }
      if (block.blockedId !== userId) {
        blockSet.add(block.blockedId);
      }
    });

    return blockSet;
  }

  private canBePaired(
    userA: string,
    userB: string,
    blocksA: Set<string>,
    blocksB: Set<string>,
    historyA: Map<string, number>,
    historyB: Map<string, number>,
    totalEligibleUsers: number,
  ): boolean {
    if (blocksA.has(userB) || blocksB.has(userA)) {
      return false;
    }

    if (totalEligibleUsers <= 2) {
      return true;
    }

    const recentlyPaired =
      (historyA.get(userB) ?? 0) > 0 || (historyB.get(userA) ?? 0) > 0;

    return !recentlyPaired;
  }
}
