import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../core/prisma/prisma.service";
import { AppLoggerService } from "../../../shared/logger/logger.service";
import { AchievementsService } from "../../achievements/services/achievements.service";
import { CycleParticipationRepository } from "../repositories/cycle-participation.repository";

/**
 * Service for checking and unlocking achievements related to cycle participation
 * Handles the Regular Participant achievement (10 consecutive cycles)
 */
@Injectable()
export class AchievementParticipationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
    private readonly achievementsService: AchievementsService,
    private readonly cycleParticipation: CycleParticipationRepository
  ) {}

  /**
   * Check for achievement unlocks after cycle participation is recorded
   * Currently checks for Regular Participant achievement (10 consecutive cycles)
   *
   * @param participatedUserIds Array of user IDs who participated in the cycle
   * @param organizationId Organization ID
   * @returns Promise<void>
   */
  async checkParticipationAchievements(
    participatedUserIds: string[],
    organizationId: string
  ): Promise<void> {
    if (participatedUserIds.length === 0) {
      return;
    }

    this.logger.debug(
      `Checking participation achievements for ${participatedUserIds.length} users in organization ${organizationId}`,
      AchievementParticipationService.name
    );

    // Regular Participant achievement: 10 consecutive cycles
    // Find the consistency achievement that represents "Regular Participant"
    const REGULAR_PARTICIPANT_THRESHOLD = 10;
    const consistencyAchievement = await this.prisma.achievement.findFirst({
      where: { type: "consistency" },
      select: { id: true, name: true },
    });

    if (!consistencyAchievement) {
      this.logger.warn(
        `Consistency achievement not found for Regular Participant`,
        AchievementParticipationService.name
      );
      return;
    }

    for (const userId of participatedUserIds) {
      try {
        const consecutiveCount = await this.cycleParticipation.getConsecutiveCount(
          userId,
          organizationId
        );

        this.logger.debug(
          `User ${userId} has ${consecutiveCount} consecutive participation cycles`,
          AchievementParticipationService.name
        );

        if (consecutiveCount >= REGULAR_PARTICIPANT_THRESHOLD) {
          // Check if already unlocked
          const existingUnlock = await this.prisma.userAchievement.findUnique({
            where: {
              userId_achievementId: {
                userId,
                achievementId: consistencyAchievement.id,
              },
            },
          });

          if (existingUnlock && existingUnlock.unlockedAt) {
            this.logger.debug(
              `User ${userId} already unlocked consistency achievement`,
              AchievementParticipationService.name
            );
            continue;
          }

          // Trigger achievement unlock
          this.logger.log(
            `Unlocking Regular Participant achievement for user ${userId} after ${consecutiveCount} consecutive cycles`,
            AchievementParticipationService.name
          );

          // Fire achievement unlock asynchronously
          this.processAchievementUnlockAsync(userId, consistencyAchievement.id);
        }
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Error checking participation achievements for user ${userId}: ${err.message}`,
          err.stack,
          AchievementParticipationService.name
        );
        // Continue processing other users on error
      }
    }
  }

  /**
   * Process achievement unlock asynchronously without blocking the pairing algorithm
   */
  private processAchievementUnlockAsync(
    userId: string,
    achievementId: string
  ): void {
    // Fire and forget - don't wait for completion
    this.achievementsService
      .unlockAchievementIfNotAlready(userId, achievementId)
      .catch((error) => {
        const err = error as Error;
        this.logger.error(
          `Failed to unlock achievement ${achievementId} for user ${userId}: ${err.message}`,
          err.stack,
          AchievementParticipationService.name
        );
      });
  }
}
