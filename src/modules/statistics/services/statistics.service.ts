import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "src/core/prisma/prisma.service";
import { withRls } from "src/db/withRls";
import type { Identity } from "src/shared/auth/domain/identity";
import { getRlsClaims } from "src/shared/auth/utils/get-rls-claims";
import { PairingStatusOverviewType } from "../graphql/types/pairing-status-overview.type";
import { PairingStatusByUserType } from "../graphql/types/pairing-status-by-user.type";
import { StatisticsResponseType } from "../graphql/types/statistics-response.type";
import { StatisticsFilterInputType } from "../graphql/types/statistics-filter-input.type";

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds date range from filter input
   * Supports:
   * - Specific date range (startDate, endDate)
   * - Month/year filter
   */
  private buildDateRange(filter: StatisticsFilterInputType): {
    startDate: Date;
    endDate: Date;
  } {
    let startDate: Date;
    let endDate: Date;

    if (filter.startDate && filter.endDate) {
      // Specific date range
      startDate = new Date(filter.startDate);
      endDate = new Date(filter.endDate);
      // Set endDate to end of day
      endDate.setHours(23, 59, 59, 999);
    } else if (filter.month && filter.year) {
      // Month/year filter
      startDate = new Date(filter.year, filter.month - 1, 1);
      endDate = new Date(filter.year, filter.month, 0, 23, 59, 59, 999);
    } else if (filter.year) {
      // Year filter only
      startDate = new Date(filter.year, 0, 1);
      endDate = new Date(filter.year, 11, 31, 23, 59, 59, 999);
    } else {
      // Default: all time
      startDate = new Date(0); // Beginning of time
      endDate = new Date(); // Now
    }

    return { startDate, endDate };
  }

  /**
   * Gets statistics for administrators
   */
  async getStatistics(
    identity: Identity,
    filter: StatisticsFilterInputType
  ): Promise<StatisticsResponseType> {
    const { startDate, endDate } = this.buildDateRange(filter);
    const claims = getRlsClaims(identity);

    return withRls(this.prisma, claims, async (tx) => {
      // Build organization filter
      const orgFilter = filter.organizationId
        ? { organizationId: filter.organizationId }
        : {};

      // 1. Pairings by status
      const pairingsByStatus = await tx.pairing.groupBy({
        by: ["status"],
        where: {
          ...orgFilter,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          id: true,
        },
      });

      // 2. Pairings by status and user
      const pairings = await tx.pairing.findMany({
        where: {
          ...orgFilter,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          status: true,
          userAId: true,
          userBId: true,
          userA: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          userB: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Group pairings by user and status
      const pairingsByUserMap = new Map<
        string,
        Map<
          string,
          { user: { id: string; email: string; name: string }; count: number }
        >
      >();

      for (const pairing of pairings) {
        // Process userA
        if (!pairingsByUserMap.has(pairing.userAId)) {
          pairingsByUserMap.set(pairing.userAId, new Map());
        }
        const userAMap = pairingsByUserMap.get(pairing.userAId)!;
        if (!userAMap.has(pairing.status)) {
          userAMap.set(pairing.status, {
            user: {
              id: pairing.userA.id,
              email: pairing.userA.email,
              name:
                [pairing.userA.firstName, pairing.userA.lastName]
                  .filter(Boolean)
                  .join(" ") || pairing.userA.email,
            },
            count: 0,
          });
        }
        userAMap.get(pairing.status)!.count++;

        // Process userB (only if userBId and userB exist)
        if (pairing.userBId && pairing.userB) {
          if (!pairingsByUserMap.has(pairing.userBId)) {
            pairingsByUserMap.set(pairing.userBId, new Map());
          }
          const userBMap = pairingsByUserMap.get(pairing.userBId)!;
          if (!userBMap.has(pairing.status)) {
            userBMap.set(pairing.status, {
              user: {
                id: pairing.userB.id,
                email: pairing.userB.email,
                name:
                  [pairing.userB.firstName, pairing.userB.lastName]
                    .filter(Boolean)
                    .join(" ") || pairing.userB.email,
              },
              count: 0,
            });
          }
          userBMap.get(pairing.status)!.count++;
        }
      }

      // Convert to array format
      const pairingsByStatusAndUser: PairingStatusByUserType[] = [];
      for (const [userId, statusMap] of pairingsByUserMap.entries()) {
        for (const [status, data] of statusMap.entries()) {
          pairingsByStatusAndUser.push({
            userId: data.user.id,
            userEmail: data.user.email,
            userName: data.user.name,
            status,
            count: data.count,
          });
        }
      }

      // 3. New users count
      const newUsersCount = await tx.user.count({
        where: {
          ...orgFilter,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // 4. Reports count
      const reportsCount = await tx.report.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          ...(filter.organizationId && {
            pairing: {
              organizationId: filter.organizationId,
            },
          }),
        },
      });

      // 5. Inactive users count
      // If date filter is provided, shows users who are inactive and were updated in that period
      // (approximates "users who became inactive in this period" using updatedAt)
      // If no date filter, shows all currently inactive users
      const inactiveUsersCount = await tx.user.count({
        where: {
          ...orgFilter,
          isActive: false,
          ...(filter.startDate || filter.month || filter.year
            ? {
                updatedAt: {
                  gte: startDate,
                  lte: endDate,
                },
              }
            : {}),
        },
      });

      return {
        pairingsByStatus: pairingsByStatus.map((item) => ({
          status: item.status,
          count: item._count.id,
        })),
        pairingsByStatusAndUser,
        newUsersCount,
        reportsCount,
        inactiveUsersCount,
      };
    });
  }

  /**
   * Gets department user distribution for an organization
   */
  async getDepartmentDistribution(organizationId: string) {
    const departmentUsers = await this.prisma.department.findMany({
      where: { organizationId },
      select: {
        name: true,
        _count: {
          select: { users: true },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const departments = departmentUsers.map((dept) => ({
      departmentName: dept.name,
      userCount: dept._count.users,
    }));

    const totalUsers = departments.reduce(
      (sum, dept) => sum + dept.userCount,
      0
    );

    return {
      departments,
      totalUsers,
    };
  }
}
