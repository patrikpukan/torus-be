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

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    private readonly achievementRepository: AchievementRepository,
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService
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
   * Shows both locked and unlocked achievements with progress
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

    const userAchievements = await this.getUserAchievements(identity, userId);

    return userAchievements.map((ua) => ({
      achievementId: ua.achievement.id,
      achievementName: ua.achievement.name,
      achievementType: ua.achievement.type,
      currentProgress: ua.currentProgress,
      targetProgress: this.getAchievementTarget(ua.achievement.type),
      isUnlocked: ua.unlockedAt !== undefined,
      unlockedAt: ua.unlockedAt,
      percentComplete: Math.min(
        100,
        Math.round(
          (ua.currentProgress / this.getAchievementTarget(ua.achievement.type)) * 100
        )
      ),
    }));
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
}
