import { Injectable } from '@nestjs/common';
import { PairingPeriodStatus, PairingStatus, User } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import { AppLoggerService } from '../shared/logger/logger.service';

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

@Injectable()
export class PairingAlgorithmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
  ) {}

  async executePairing(organizationId: string): Promise<void> {
    this.logger.log(
      `Pairing algorithm started for organization: ${organizationId}`,
      PairingAlgorithmService.name,
    );

    let algorithmSettings = await this.prisma.algorithmSetting.findUnique({
      where: { organizationId },
    });

    if (!algorithmSettings) {
      algorithmSettings = await this.prisma.algorithmSetting.create({
        data: {
          organizationId,
          periodLengthDays: 21,
          randomSeed: Date.now(),
        },
      });
    }

    const periodLengthDays = algorithmSettings.periodLengthDays ?? 21;

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

      pairingPeriod = await this.prisma.pairingPeriod.create({
        data: {
          organizationId,
          status: PairingPeriodStatus.active,
          startDate,
          endDate,
        },
      });
    }

    const eligibleUsers = await this.getEligibleUsers(organizationId, pairingPeriod.id);

    const [newUserIds, unpairedUserIds] = await Promise.all([
      this.getNewUsers(organizationId),
      this.getUnpairedFromLastPeriod(organizationId, pairingPeriod.id),
    ]);
    const guaranteedUserIds = Array.from(
      new Set<string>([...newUserIds, ...unpairedUserIds]),
    );

    const random = new SeededRandom(algorithmSettings.randomSeed ?? Date.now());

    const totalEligibleUsers = eligibleUsers.length;

    if (totalEligibleUsers < 2) {
      throw new Error('Not enough users to create pairings');
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

        if (potentialPartners.length === 0) {
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
          unpairedUsers.add(userId);
          availableUsers.delete(userId);
          return;
        }

        availableUsers.delete(userId);
        availableUsers.delete(selected.candidateId);

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
              throw new Error(
                `Unable to avoid three consecutive pairings for users ${pair.userAId} and ${pair.userBId}`,
              );
            }
          }
        });
      }

      if (pairs.length > 0) {
        const now = new Date();
        await this.prisma.pairing.createMany({
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
