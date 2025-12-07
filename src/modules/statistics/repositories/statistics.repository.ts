import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

/**
 * Repository for statistics data access.
 * Handles all Prisma queries for generating statistics reports.
 */
@Injectable()
export class StatisticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get pairing counts by status for a date range
   */
  async getPairingStatusCounts(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ status: string; count: number }>> {
    const pairings = await this.prisma.pairing.groupBy({
      by: ['organizationId'],
      where: {
        organizationId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
    });

    return pairings.map((p) => ({
      status: 'active',
      count: p._count.id,
    }));
  }

  /**
   * Get pairing statistics by user
   */
  async getPairingsByUser(
    organizationId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ partnerId: string; count: number }>> {
    const pairings = await this.prisma.pairing.findMany({
      where: {
        organizationId,
        AND: [
          {
            OR: [
              { userAId: userId },
              { userBId: userId },
            ],
          },
          {
            period: {
              startDate: { gte: startDate },
              endDate: { lte: endDate },
            },
          },
        ],
      },
      select: {
        userAId: true,
        userBId: true,
      },
    });

    const partnerMap = new Map<string, number>();
    for (const pairing of pairings) {
      const partnerId = pairing.userAId === userId ? pairing.userBId : pairing.userAId;
      partnerMap.set(partnerId, (partnerMap.get(partnerId) ?? 0) + 1);
    }

    return Array.from(partnerMap.entries()).map(([partnerId, count]) => ({
      partnerId,
      count,
    }));
  }

  /**
   * Get all pairings for an organization within a date range
   */
  async getPairings(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{
    id: string;
    userAId: string;
    userBId: string;
    createdAt: Date;
  }>> {
    return this.prisma.pairing.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        userAId: true,
        userBId: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get user details by ID
   */
  async getUserById(userId: string): Promise<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  /**
   * Get all users in an organization
   */
  async getOrganizationUsers(organizationId: string): Promise<Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>> {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  /**
   * Get pairing period information
   */
  async getPairingPeriod(periodId: string): Promise<{
    id: string;
    startDate: Date | null;
    endDate: Date | null;
    status: string;
  } | null> {
    const period = await this.prisma.pairingPeriod.findUnique({
      where: { id: periodId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    if (!period) return null;

    return {
      id: period.id,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
    };
  }

  /**
   * Get active pairing period for organization
   */
  async getActivePeriod(organizationId: string): Promise<{
    id: string;
    startDate: Date | null;
    endDate: Date | null;
  } | null> {
    const period = await this.prisma.pairingPeriod.findFirst({
      where: {
        organizationId,
        status: 'active',
      },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!period) return null;

    return {
      id: period.id,
      startDate: period.startDate,
      endDate: period.endDate,
    };
  }

  /**
   * Get pairing periods for organization within date range
   */
  async getPeriods(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{
    id: string;
    startDate: Date | null;
    endDate: Date | null;
    status: string;
  }>> {
    const periods = await this.prisma.pairingPeriod.findMany({
      where: {
        organizationId,
        OR: [
          {
            startDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            endDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        ],
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    return periods.map((p) => ({
      id: p.id,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
    }));
  }
}
