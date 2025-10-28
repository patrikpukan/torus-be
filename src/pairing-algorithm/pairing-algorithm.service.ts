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
}
