import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import {
  AlgorithmSetting,
  Pairing,
  PairingPeriod,
  UserBlock,
  PairingPeriodStatus,
  UserRole,
} from '@prisma/client';

/**
 * Repository for pairing algorithm data access.
 * Handles all Prisma operations for pairing-related entities:
 * - AlgorithmSettings
 * - PairingPeriods
 * - Pairings
 * - UserBlocks
 * - User lookups for pairing
 */
@Injectable()
export class PairingAlgorithmRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ============== AlgorithmSetting Operations ==============

  async getSettingsByOrganization(organizationId: string): Promise<AlgorithmSetting | null> {
    return this.prisma.algorithmSetting.findUnique({
      where: { organizationId },
    });
  }

  async getAllConfiguredOrganizations(): Promise<AlgorithmSetting[]> {
    return this.prisma.algorithmSetting.findMany();
  }

  async createSettings(organizationId: string, data: Partial<AlgorithmSetting>): Promise<AlgorithmSetting> {
    return this.prisma.algorithmSetting.create({
      data: {
        organizationId,
        ...data,
      },
    });
  }

  async updateSettings(organizationId: string, data: Partial<AlgorithmSetting>): Promise<AlgorithmSetting> {
    return this.prisma.algorithmSetting.update({
      where: { organizationId },
      data,
    });
  }

  // ============== PairingPeriod Operations ==============

  async getActivePeriod(organizationId: string): Promise<PairingPeriod | null> {
    return this.prisma.pairingPeriod.findFirst({
      where: { organizationId, status: PairingPeriodStatus.active },
      orderBy: { startDate: 'desc' },
    });
  }

  async getPeriodById(periodId: string): Promise<PairingPeriod | null> {
    return this.prisma.pairingPeriod.findUnique({
      where: { id: periodId },
    });
  }

  async getPreviousPeriods(
    organizationId: string,
    limit: number = 5,
  ): Promise<PairingPeriod[]> {
    return this.prisma.pairingPeriod.findMany({
      where: { organizationId },
      orderBy: { startDate: 'desc' },
      take: limit,
    });
  }

  async getPeriodsByStatus(
    organizationId: string,
    status: PairingPeriodStatus,
  ): Promise<PairingPeriod[]> {
    return this.prisma.pairingPeriod.findMany({
      where: { organizationId, status },
      orderBy: { startDate: 'desc' },
    });
  }

  async createPeriod(data: {
    organizationId: string;
    startDate: Date;
    endDate?: Date;
    status?: PairingPeriodStatus;
  }): Promise<PairingPeriod> {
    return this.prisma.pairingPeriod.create({
      data: {
        organizationId: data.organizationId,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status || PairingPeriodStatus.active,
      },
    });
  }

  async updatePeriodStatus(
    periodId: string,
    status: PairingPeriodStatus,
  ): Promise<PairingPeriod> {
    return this.prisma.pairingPeriod.update({
      where: { id: periodId },
      data: { status },
    });
  }

  // ============== Pairing Operations ==============

  async getPairingCount(organizationId: string): Promise<number> {
    return this.prisma.pairing.count({
      where: { organizationId },
    });
  }

  async getPairingsByPeriod(periodId: string): Promise<Pairing[]> {
    return this.prisma.pairing.findMany({
      where: { periodId },
    });
  }

  async getPairingsByUser(userId: string): Promise<Pairing[]> {
    return this.prisma.pairing.findMany({
      where: {
        OR: [
          { userAId: userId },
          { userBId: userId },
        ],
      },
    });
  }

  async getPairingsByOrganization(organizationId: string): Promise<Pairing[]> {
    return this.prisma.pairing.findMany({
      where: { organizationId },
    });
  }

  async getPairingsByOrganizationAndPeriod(
    organizationId: string,
    periodId: string,
  ): Promise<Pairing[]> {
    return this.prisma.pairing.findMany({
      where: { organizationId, periodId },
    });
  }

  async createPairing(data: {
    periodId: string;
    organizationId: string;
    userAId: string;
    userBId: string;
  }): Promise<Pairing> {
    return this.prisma.pairing.create({
      data,
    });
  }

  async createPairingsBatch(pairings: Array<{
    periodId: string;
    organizationId: string;
    userAId: string;
    userBId: string;
  }>): Promise<Pairing[]> {
    return this.prisma.$transaction((tx) =>
      Promise.all(
        pairings.map((p) =>
          tx.pairing.create({
            data: p,
          })
        )
      )
    );
  }

  // ============== User Operations ==============

  async getUserCount(organizationId: string): Promise<number> {
    return this.prisma.user.count({
      where: { organizationId, isActive: true },
    });
  }

  async getEligibleUsers(organizationId: string): Promise<Array<{ id: string }>> {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        role: UserRole.user,
      },
      select: { id: true },
    });
  }

  async getNewUsersInPeriod(
    organizationId: string,
    periodStartDate: Date,
  ): Promise<Array<{ id: string; createdAt: Date }>> {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        createdAt: { gte: periodStartDate },
        isActive: true,
      },
      select: { id: true, createdAt: true },
    });
  }

  async getPairedUsersInPeriod(
    organizationId: string,
    periodId: string,
  ): Promise<string[]> {
    const pairings = await this.prisma.pairing.findMany({
      where: { organizationId, periodId },
      select: {
        userAId: true,
        userBId: true,
      },
    });

    const userIds = new Set<string>();
    for (const pairing of pairings) {
      userIds.add(pairing.userAId);
      userIds.add(pairing.userBId);
    }
    return Array.from(userIds);
  }

  async getUnpairedUserCount(
    organizationId: string,
    periodId: string,
  ): Promise<number> {
    const activePeriod = await this.prisma.pairingPeriod.findUnique({
      where: { id: periodId },
    });

    if (!activePeriod) {
      return 0;
    }

    const pairedUsers = await this.getPairedUsersInPeriod(organizationId, periodId);
    const totalEligible = await this.getEligibleUsers(organizationId);
    const unpaired = totalEligible.filter((u) => !pairedUsers.includes(u.id));

    return unpaired.length;
  }

  // ============== UserBlock Operations ==============

  async getBlockedPairs(organizationId: string): Promise<UserBlock[]> {
    return this.prisma.userBlock.findMany({
      where: { organizationId },
    });
  }

  async getRecentBlockedPairs(
    organizationId: string,
    periods: number = 2,
  ): Promise<Array<{ userAId: string; userBId: string }>> {
    const recentPeriods = await this.prisma.pairingPeriod.findMany({
      where: { organizationId },
      orderBy: { startDate: 'desc' },
      take: periods,
      select: { id: true },
    });

    if (recentPeriods.length === 0) {
      return [];
    }

    const periodIds = recentPeriods.map((p) => p.id);

    const pairings = await this.prisma.pairing.findMany({
      where: {
        organizationId,
        periodId: { in: periodIds },
      },
      select: {
        userAId: true,
        userBId: true,
      },
    });

    return pairings.map((p) => ({
      userAId: p.userAId,
      userBId: p.userBId,
    }));
  }

  async isUserBlockedWithPeer(
    organizationId: string,
    userId: string,
    peerId: string,
  ): Promise<boolean> {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        organizationId,
        OR: [
          { user1Id: userId, user2Id: peerId },
          { user1Id: peerId, user2Id: userId },
        ],
      },
    });

    return !!block;
  }

  // ============== Organization Operations ==============

  async organizationExists(organizationId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    return !!org;
  }

  // ============== Transaction Support ==============

  /**
   * Create multiple pairings in a single transaction
   * This is a convenience method that wraps Prisma transaction
   */
  async createPairingsBatchTransaction(pairings: Array<{
    periodId: string;
    organizationId: string;
    userAId: string;
    userBId: string;
  }>): Promise<Pairing[]> {
    return this.prisma.$transaction(
      pairings.map((p) =>
        this.prisma.pairing.create({
          data: p,
        })
      )
    );
  }
}
