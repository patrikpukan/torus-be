import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
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
