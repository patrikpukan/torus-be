import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../core/prisma/prisma.service";
import { AppLoggerService } from "../../../shared/logger/logger.service";

/**
 * Repository for managing user participation tracking across pairing cycles
 * Tracks consecutive cycle participation for the Regular Participant achievement
 */
@Injectable()
export class CycleParticipationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService
  ) {}

  /**
   * Get or create a cycle participation record for a user in an organization
   */
  async getOrCreateParticipation(userId: string, organizationId: string) {
    return this.prisma.cycleParticipation.upsert({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      create: {
        userId,
        organizationId,
        consecutiveCount: 1,
      },
      update: {},
    });
  }

  /**
   * Increment consecutive participation count for a user
   */
  async incrementConsecutiveCount(
    userId: string,
    organizationId: string,
    cycleNumber: number
  ) {
    const participation = await this.getOrCreateParticipation(
      userId,
      organizationId
    );

    // Check if user participated in the previous cycle
    const isConsecutive =
      participation.lastParticipationCycle === undefined ||
      participation.lastParticipationCycle === cycleNumber - 1;

    if (!isConsecutive) {
      // User skipped a cycle, reset counter
      this.logger.debug(
        `User ${userId} skipped a cycle. Resetting consecutive count from ${participation.consecutiveCount} to 1`,
        CycleParticipationRepository.name
      );
      return this.prisma.cycleParticipation.update({
        where: { userId_organizationId: { userId, organizationId } },
        data: {
          consecutiveCount: 1,
          lastParticipationCycle: cycleNumber,
        },
      });
    }

    // Increment consecutive count
    const newCount = (participation.consecutiveCount || 0) + 1;
    return this.prisma.cycleParticipation.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: {
        consecutiveCount: newCount,
        lastParticipationCycle: cycleNumber,
      },
    });
  }

  /**
   * Get consecutive participation count for a user
   */
  async getConsecutiveCount(
    userId: string,
    organizationId: string
  ): Promise<number> {
    const participation = await this.prisma.cycleParticipation.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    });

    return participation?.consecutiveCount ?? 0;
  }

  /**
   * Mark users as participated in a specific cycle number
   * Used by the pairing algorithm to track which cycles a user participated in
   */
  async markParticipated(
    userIds: string[],
    organizationId: string,
    cycleNumber: number
  ): Promise<number> {
    if (userIds.length === 0) {
      return 0;
    }

    const result = await this.prisma.cycleParticipation.updateMany({
      where: {
        userId: { in: userIds },
        organizationId,
      },
      data: {
        lastParticipationCycle: cycleNumber,
        consecutiveCount: {
          increment: 1,
        },
      },
    });

    return result.count;
  }

  /**
   * Reset consecutive count for users who didn't participate in this cycle
   * @param allUserIds All active users in organization
   * @param participatedUserIds Users who participated in current cycle
   * @param organizationId Organization ID
   * @param cycleNumber Current cycle number
   */
  async resetNonParticipants(
    allUserIds: string[],
    participatedUserIds: string[],
    organizationId: string,
    cycleNumber: number
  ): Promise<void> {
    const participatedSet = new Set(participatedUserIds);
    const nonParticipantIds = allUserIds.filter(
      (id) => !participatedSet.has(id)
    );

    if (nonParticipantIds.length === 0) {
      return;
    }

    // Reset consecutive count to 0 for users who didn't participate
    // But keep their record for future tracking
    await this.prisma.cycleParticipation.updateMany({
      where: {
        userId: { in: nonParticipantIds },
        organizationId,
      },
      data: {
        consecutiveCount: 0,
        lastParticipationCycle: cycleNumber - 1, // Last non-participating cycle
      },
    });
  }
}
