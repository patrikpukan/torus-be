import { Injectable } from '@nestjs/common';
import { PairingPeriodStatus, User } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import { AppLoggerService } from '../shared/logger/logger.service';

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
      const endDate = new Date(
        startDate.getTime() + periodLengthDays * 24 * 60 * 60 * 1000,
      );

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

    if (eligibleUsers.length < 2) {
      throw new Error('Not enough users to create pairings');
    }

    if (eligibleUsers.length % 2 !== 0) {
      this.logger.warn(
        `Odd number of users, one will remain unpaired (eligible count: ${eligibleUsers.length})`,
        PairingAlgorithmService.name,
      );
    }

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

    const logPayload = {
      algorithmSettings,
      pairingPeriod,
      eligibleUserIds: eligibleUsers.map((user) => user.id),
      guaranteedUserIds,
      histories: Array.from(userHistories.entries()).map(([userId, history]) => ({
        userId,
        history: Array.from(history.entries()),
      })),
      blocks: Array.from(userBlocks.entries()).map(([userId, blocks]) => ({
        userId,
        blocks: Array.from(blocks.values()),
      })),
    };

    this.logger.debug(
      `Pairing algorithm context: ${JSON.stringify(logPayload)}`,
      PairingAlgorithmService.name,
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
