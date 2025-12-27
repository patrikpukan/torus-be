import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/core/prisma/prisma.service";
import { AchievementRepository } from "../repositories/achievement.repository";
import {
  Achievement,
  AchievementProgressView,
  AchievementUnlockEvent,
  UserAchievementView,
} from "../domain/achievement";
import { AuthorizationService } from "src/shared/auth/services/authorization.service";
import { Identity } from "src/shared/auth/domain/identity";
import { UserRoleEnum } from "src/modules/users/domain/user";
import { AchievementProgressService } from "./achievement-progress.service";
import { AppLoggerService } from "src/shared/logger/logger.service";

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    private readonly achievementRepository: AchievementRepository,
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService,
    private readonly progressService: AchievementProgressService,
    private readonly appLogger: AppLoggerService
  ) {}

  /**
   * Fetch all achievements for a user with unlock status
   * Authorization: Users can only see their own achievements
   *                Org admins can see organization-wide achievements
   */
  async getUserAchievements(
    identity: Identity,
    userId: string
  ): Promise<UserAchievementView[]> {
    // Authorization check
    const canView = userId === identity.id || identity.appRole === UserRoleEnum.org_admin;
    if (!canView) {
      throw new Error("Unauthorized to view achievements");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return this.achievementRepository.getUserAchievementsWithStatus(
      userId,
      user.organizationId
    );
  }

  /**
   * Get achievement progress for all achievements (for dashboard/profile)
   * Shows both locked and unlocked achievements with real-time progress calculation
   * Progress is calculated efficiently with caching for expensive queries
   */
  async getUserAchievementProgress(
    identity: Identity,
    userId: string
  ): Promise<AchievementProgressView[]> {
    // Authorization check
    const canView = userId === identity.id || identity.appRole === UserRoleEnum.org_admin;
    if (!canView) {
      throw new Error("Unauthorized to view achievement progress");
    }

    // Get user's organization for progress calculations
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Calculate real-time progress for all achievements
    const progressList = await this.progressService.getUserAchievementProgress(
      userId,
      user.organizationId
    );

    // Get all achievements for detailed mapping
    const achievements = await this.achievementRepository.getAllAchievements();
    const achievementMap = new Map(achievements.map((a) => [a.id, a]));

    // Get user's unlocked achievements
    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
    });

    const unlockedMap = new Map(
      userAchievements
        .filter((ua) => ua.unlockedAt)
        .map((ua) => [ua.achievementId, ua])
    );

    // Combine progress with achievement details
    return progressList.map((progress) => {
      const achievement = achievementMap.get(progress.achievementId);
      const unlockedAtData = unlockedMap.get(progress.achievementId)?.unlockedAt;
      const unlockedAt = unlockedAtData ? new Date(unlockedAtData) : undefined;

      return {
        achievementId: progress.achievementId,
        achievementName: achievement?.name || "",
        achievementDescription: achievement?.description || "",
        achievementImageIdentifier: achievement?.imageIdentifier || "",
        achievementType: achievement?.type || "",
        pointValue: achievement?.pointValue || 0,
        currentProgress: progress.currentProgress,
        targetProgress: progress.targetProgress,
        isUnlocked: progress.isUnlocked || !!unlockedAt,
        unlockedAt,
        percentComplete: progress.percentComplete,
      } as AchievementProgressView;
    });
  }

  /**
   * Calculate total points earned by a user from unlocked achievements
   * @param userId - User ID
   * @returns Total points from all unlocked achievements
   */
  async getTotalEarnedPoints(userId: string): Promise<number> {
    const unlockedAchievements = await this.prisma.userAchievement.findMany({
      where: {
        userId,
        unlockedAt: { not: null },
      },
      include: {
        achievement: {
          select: {
            pointValue: true,
          },
        },
      },
    });

    return unlockedAchievements.reduce(
      (total, ua) => total + (ua.achievement.pointValue || 0),
      0
    );
  }

  /**
   * Get total possible points from all achievements in an organization
   * @param organizationId - Organization ID
   * @returns Total possible points
   */
  async getTotalPossiblePoints(): Promise<number> {
    const achievements = await this.achievementRepository.getAllAchievements();
    return achievements.reduce((total, a) => total + (a.pointValue || 0), 0);
  }

  /**
   * Process achievement unlocks after a specific event
   * Called from resolvers/mutations when events occur
   */
  async processAchievementUnlock(
    userId: string,
    event: AchievementUnlockEvent
  ): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      // Ensure user achievement records exist for all achievements
      const achievements = await this.achievementRepository.getAllAchievements(tx);
      for (const achievement of achievements) {
        await this.achievementRepository.getOrCreateUserAchievement(
          userId,
          achievement.id,
          tx
        );
      }

      // Process unlock based on event type
      switch (event.type) {
        case "meeting_completed":
          await this.checkMeetingBasedAchievements(userId, tx);
          break;
        case "rating_submitted":
          await this.checkMeetingBasedAchievements(userId, tx);
          break;
        case "pairing_completed":
          await this.checkConsecutiveCycleAchievement(userId, tx);
          break;
        case "cycle_completed":
          await this.checkConsecutiveCycleAchievement(userId, tx);
          break;
      }
    });
  }

  /**
   * Check and unlock meeting-based achievements:
   * - Newcomer (first meeting)
   * - Social Butterfly (10 different people)
   * - Bridge Builder (cross-department)
   * - Pairing Legend (50 meetings)
   */
  private async checkMeetingBasedAchievements(
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const totalMeetings = await this.achievementRepository.countUserMeetings(
      userId,
      tx
    );
    const uniquePartners =
      await this.achievementRepository.countUniqueMeetingPartners(userId, tx);
    const hasCrossDeptMeeting =
      await this.achievementRepository.hasMetDifferentDepartment(userId, tx);

    // Get the achievements to check
    const achievements = await this.achievementRepository.getAllAchievements(tx);

    // Newcomer: 1 completed meeting
    if (totalMeetings >= 1) {
      const newcomer = achievements.find((a) => a.name === "Newcomer");
      if (newcomer && totalMeetings === 1) {
        await this.achievementRepository.unlockAchievement(userId, newcomer.id, tx);
        this.logger.log(`Unlocked Newcomer achievement for user ${userId}`);
      }
    }

    // Social Butterfly: 10 unique meeting partners
    if (uniquePartners >= 10) {
      const socialButterfly = achievements.find((a) => a.name === "Social Butterfly");
      if (socialButterfly) {
        const userAchievement =
          await this.achievementRepository.getOrCreateUserAchievement(
            userId,
            socialButterfly.id,
            tx
          );
        if (!userAchievement.unlockedAt) {
          await this.achievementRepository.unlockAchievement(
            userId,
            socialButterfly.id,
            tx
          );
          this.logger.log(`Unlocked Social Butterfly achievement for user ${userId}`);
        }
      }
    } else {
      // Update progress for Social Butterfly
      const socialButterfly = achievements.find((a) => a.name === "Social Butterfly");
      if (socialButterfly) {
        await this.achievementRepository.updateAchievementProgress(
          userId,
          socialButterfly.id,
          uniquePartners,
          tx
        );
      }
    }

    // Bridge Builder: cross-department meeting
    if (hasCrossDeptMeeting) {
      const bridgeBuilder = achievements.find((a) => a.name === "Bridge Builder");
      if (bridgeBuilder) {
        const userAchievement =
          await this.achievementRepository.getOrCreateUserAchievement(
            userId,
            bridgeBuilder.id,
            tx
          );
        if (!userAchievement.unlockedAt) {
          await this.achievementRepository.unlockAchievement(
            userId,
            bridgeBuilder.id,
            tx
          );
          this.logger.log(`Unlocked Bridge Builder achievement for user ${userId}`);
        }
      }
    }

    // Pairing Legend: 50 meetings
    if (totalMeetings >= 50) {
      const pairingLegend = achievements.find((a) => a.name === "Pairing Legend");
      if (pairingLegend) {
        const userAchievement =
          await this.achievementRepository.getOrCreateUserAchievement(
            userId,
            pairingLegend.id,
            tx
          );
        if (!userAchievement.unlockedAt) {
          await this.achievementRepository.unlockAchievement(
            userId,
            pairingLegend.id,
            tx
          );
          this.logger.log(`Unlocked Pairing Legend achievement for user ${userId}`);
        }
      }
    } else {
      // Update progress for Pairing Legend
      const pairingLegend = achievements.find((a) => a.name === "Pairing Legend");
      if (pairingLegend) {
        await this.achievementRepository.updateAchievementProgress(
          userId,
          pairingLegend.id,
          totalMeetings,
          tx
        );
      }
    }
  }

  /**
   * Check and unlock consistency-based achievements:
   * - Regular Participant (10 consecutive cycles)
   */
  private async checkConsecutiveCycleAchievement(
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const consecutiveCycles =
      await this.achievementRepository.countConsecutivePairingCycles(userId, tx);

    const achievements = await this.achievementRepository.getAllAchievements(tx);
    const regularParticipant = achievements.find(
      (a) => a.name === "Regular Participant"
    );

    if (!regularParticipant) {
      return;
    }

    if (consecutiveCycles >= 10) {
      const userAchievement =
        await this.achievementRepository.getOrCreateUserAchievement(
          userId,
          regularParticipant.id,
          tx
        );
      if (!userAchievement.unlockedAt) {
        await this.achievementRepository.unlockAchievement(
          userId,
          regularParticipant.id,
          tx
        );
        this.logger.log(`Unlocked Regular Participant achievement for user ${userId}`);
      }
    } else {
      // Update progress
      await this.achievementRepository.updateAchievementProgress(
        userId,
        regularParticipant.id,
        consecutiveCycles,
        tx
      );
    }
  }

  /**
   * Calculate target progress for an achievement based on type
   */
  private getAchievementTarget(type: string): number {
    // Map achievement names to their targets
    // This is more reliable than using the type enum
    const nameTargets: Record<string, number> = {
      "Newcomer": 1,
      "Social Butterfly": 10,
      "Bridge Builder": 1, // Binary achievement
      "Regular Participant": 10,
      "Pairing Legend": 50,
    };

    // Fallback to type-based targets for other achievements
    const typeTargets: Record<string, number> = {
      milestone: 1,
      social: 10,
      engagement: 50,
      consistency: 10,
      legendary: 50,
    };

    return typeTargets[type] || 1;
  }

  /**
   * Send pending achievement notifications
   * Org admins/notifications service will call this to send notifications
   */
  async getUnnotifiedAchievements(
    organizationId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || this.prisma;
    return client.userAchievement.findMany({
      where: {
        unlockedAt: { not: null },
        notificationSent: false,
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
          },
        },
        achievement: true,
      },
      take: 1000, // Process in batches
    });
  }

  /**
   * Mark achievement notification as sent after delivery
   */
  async markNotificationAsSent(
    userId: string,
    achievementId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    await this.achievementRepository.markNotificationSent(
      userId,
      achievementId,
      tx
    );
  }

  /**
   * Get organization-wide achievement statistics (org_admin only)
   */
  async getOrganizationAchievementStats(
    identity: Identity,
    organizationId: string
  ) {
    // Check if user is org_admin
    const isOrgAdmin = identity.appRole === UserRoleEnum.org_admin;
    if (!isOrgAdmin) {
      throw new Error("Only organization admins can view achievement statistics");
    }

    const achievements = await this.achievementRepository.getAllAchievements();

    const stats = await Promise.all(
      achievements.map(async (achievement) => {
        const users =
          await this.achievementRepository.getUsersWithAchievement(
            achievement.id,
            organizationId
          );

        return {
          achievement,
          unlockedByCount: users.length,
          users: users.map((ua) => ({
            userId: ua.user.id,
            email: ua.user.email,
            name: `${ua.user.firstName} ${ua.user.lastName}`,
            unlockedAt: ua.unlockedAt,
          })),
        };
      })
    );

    return stats;
  }

  /**
   * Reset user achievements (admin only, for testing/migration)
   */
  async resetUserAchievements(
    identity: Identity,
    userId: string,
    organizationId: string
  ): Promise<void> {
    // Check if user is org_admin
    const isOrgAdmin = identity.appRole === UserRoleEnum.org_admin;
    if (!isOrgAdmin) {
      throw new Error("Only organization admins can reset achievements");
    }

    await this.prisma.userAchievement.deleteMany({
      where: {
        userId,
        user: { organizationId },
      },
    });

    this.logger.log(`Reset achievements for user ${userId}`);
  }

  /**
   * Unlock an achievement for a user if not already unlocked
   * Used by background jobs and async achievement checks (e.g., cycle participation)
   *
   * @param userId - User ID
   * @param achievementId - Achievement ID
   * @returns Promise<boolean> true if newly unlocked, false if already unlocked
   */
  async unlockAchievementIfNotAlready(
    userId: string,
    achievementId: string
  ): Promise<boolean> {
    const existing = await this.prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: { userId, achievementId },
      },
    });

    if (existing?.unlockedAt) {
      this.logger.debug(
        `Achievement ${achievementId} already unlocked for user ${userId}`
      );
      return false;
    }

    const now = new Date();
    await this.prisma.userAchievement.upsert({
      where: {
        userId_achievementId: { userId, achievementId },
      },
      create: {
        userId,
        achievementId,
        unlockedAt: now,
      },
      update: {
        unlockedAt: now,
      },
    });

    // Invalidate progress cache for this user
    this.progressService.clearUserCache(userId);

    this.logger.log(
      `Unlocked achievement ${achievementId} for user ${userId}`
    );
    return true;
  }
}
