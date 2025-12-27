import { Injectable } from "@nestjs/common";
import { Prisma, AchievementType } from "@prisma/client";
import { PrismaService } from "src/core/prisma/prisma.service";
import { Achievement, UserAchievementView } from "../domain/achievement";

@Injectable()
export class AchievementRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch all achievements
   */
  async getAllAchievements(
    tx?: Prisma.TransactionClient
  ): Promise<Achievement[]> {
    const client = tx || this.prisma;
    return client.achievement.findMany({
      where: { isActive: true },
      orderBy: { pointValue: "asc" },
    });
  }

  /**
   * Fetch achievement by ID
   */
  async getAchievementById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<Achievement | null> {
    const client = tx || this.prisma;
    return client.achievement.findUnique({
      where: { id },
    });
  }

  /**
   * Fetch all user achievements with unlock status
   * Efficiently loads all achievements with user's progress in one query
   */
  async getUserAchievementsWithStatus(
    userId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient
  ): Promise<UserAchievementView[]> {
    const client = tx || this.prisma;

    // Get all achievements
    const achievements = await client.achievement.findMany({
      where: { isActive: true },
      orderBy: { pointValue: "asc" },
    });

    // Get user's achievement progress
    const userAchievements = await client.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: true,
      },
    });

    // Create a map for quick lookup
    const userAchievementMap = new Map(
      userAchievements.map((ua) => [ua.achievementId, ua])
    );

    // Combine achievements with user progress
    return achievements.map((achievement) => {
      const userProgress = userAchievementMap.get(achievement.id);
      return {
        id: userProgress?.id || "",
        achievement,
        unlockedAt: userProgress?.unlockedAt || undefined,
        currentProgress: userProgress?.currentProgress || 0,
        notificationSent: userProgress?.notificationSent || false,
        createdAt: userProgress?.createdAt || new Date(),
        updatedAt: userProgress?.updatedAt || new Date(),
      };
    });
  }

  /**
   * Get or create user achievement record
   */
  async getOrCreateUserAchievement(
    userId: string,
    achievementId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || this.prisma;
    return client.userAchievement.upsert({
      where: {
        userId_achievementId: { userId, achievementId },
      },
      update: {},
      create: {
        userId,
        achievementId,
        currentProgress: 0,
        notificationSent: false,
      },
    });
  }

  /**
   * Update user achievement progress
   */
  async updateAchievementProgress(
    userId: string,
    achievementId: string,
    currentProgress: number,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || this.prisma;
    return client.userAchievement.update({
      where: {
        userId_achievementId: { userId, achievementId },
      },
      data: {
        currentProgress,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Unlock an achievement for a user
   */
  async unlockAchievement(
    userId: string,
    achievementId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || this.prisma;
    return client.userAchievement.update({
      where: {
        userId_achievementId: { userId, achievementId },
      },
      data: {
        unlockedAt: new Date(),
        notificationSent: false,
        updatedAt: new Date(),
      },
      include: {
        achievement: true,
      },
    });
  }

  /**
   * Mark achievement notification as sent
   */
  async markNotificationSent(
    userId: string,
    achievementId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || this.prisma;
    return client.userAchievement.update({
      where: {
        userId_achievementId: { userId, achievementId },
      },
      data: {
        notificationSent: true,
      },
    });
  }

  /**
   * Count total meetings for a user (excluding cancelled)
   */
  async countUserMeetings(
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx || this.prisma;
    return client.meetingEvent.count({
      where: {
        cancelledAt: null,
        OR: [
          { userAId: userId },
          { userBId: userId },
        ],
        userAConfirmationStatus: "confirmed",
        userBConfirmationStatus: "confirmed",
      },
    });
  }

  /**
   * Count unique users a user has met with
   */
  async countUniqueMeetingPartners(
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx || this.prisma;

    const results = await client.meetingEvent.findMany({
      where: {
        cancelledAt: null,
        OR: [
          { userAId: userId },
          { userBId: userId },
        ],
        userAConfirmationStatus: "confirmed",
        userBConfirmationStatus: "confirmed",
      },
      select: {
        userAId: true,
        userBId: true,
      },
    });

    const uniquePartners = new Set<string>();
    for (const meeting of results) {
      if (meeting.userAId === userId) {
        uniquePartners.add(meeting.userBId);
      } else {
        uniquePartners.add(meeting.userAId);
      }
    }

    return uniquePartners.size;
  }

  /**
   * Check if user has met someone from a different department
   */
  async hasMetDifferentDepartment(
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    const client = tx || this.prisma;

    // Get user's department
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });

    if (!user?.departmentId) {
      return false;
    }

    // Check if any confirmed meeting partner is from different department
    const meeting = await client.meetingEvent.findFirst({
      where: {
        cancelledAt: null,
        OR: [
          { userAId: userId },
          { userBId: userId },
        ],
        userAConfirmationStatus: "confirmed",
        userBConfirmationStatus: "confirmed",
      },
      include: {
        userA: { select: { departmentId: true } },
        userB: { select: { departmentId: true } },
      },
    });

    if (!meeting) {
      return false;
    }

    const otherUserDept =
      meeting.userAId === userId ? meeting.userB.departmentId : meeting.userA.departmentId;

    return otherUserDept !== user.departmentId;
  }

  /**
   * Count consecutive pairing period participations
   * Returns the count of consecutive periods a user has participated in
   */
  async countConsecutivePairingCycles(
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx || this.prisma;

    // Get all periods the user has participated in, ordered by date
    const participations = await client.pairing.findMany({
      where: {
        OR: [
          { userAId: userId },
          { userBId: userId },
        ],
      },
      select: {
        periodId: true,
        period: {
          select: {
            id: true,
            startDate: true,
          },
        },
      },
      orderBy: {
        period: {
          startDate: "asc",
        },
      },
    });

    if (participations.length === 0) {
      return 0;
    }

    // Remove duplicates (a user might appear twice in a period as userA and userB)
    const uniquePeriodIds = Array.from(
      new Set(participations.map((p) => p.periodId))
    );

    // Get period details in order
    const periods = await client.pairingPeriod.findMany({
      where: {
        id: {
          in: uniquePeriodIds,
        },
      },
      orderBy: {
        startDate: "asc",
      },
    });

    if (periods.length === 0) {
      return 0;
    }

    // Count consecutive periods from the most recent backwards
    let consecutiveCount = 1;
    for (let i = periods.length - 1; i > 0; i--) {
      const currentPeriod = periods[i];
      const previousPeriod = periods[i - 1];

      // Both dates should exist, but add safety checks
      if (!currentPeriod.startDate || !previousPeriod.startDate) {
        break;
      }

      // Calculate days between periods
      const daysDiff = Math.floor(
        (currentPeriod.startDate.getTime() - previousPeriod.startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // If less than 90 days apart, consider them consecutive (adjust as needed)
      if (daysDiff <= 90) {
        consecutiveCount++;
      } else {
        break;
      }
    }

    return consecutiveCount;
  }

  /**
   * Get achievements of a specific type
   */
  async getAchievementsByType(
    type: AchievementType,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || this.prisma;
    return client.achievement.findMany({
      where: {
        type,
        isActive: true,
      },
    });
  }

  /**
   * Get users who have unlocked a specific achievement (for org admins)
   */
  async getUsersWithAchievement(
    achievementId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || this.prisma;
    return client.userAchievement.findMany({
      where: {
        achievementId,
        unlockedAt: { not: null },
        user: {
          organizationId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: {
        unlockedAt: "desc",
      },
    });
  }
}
