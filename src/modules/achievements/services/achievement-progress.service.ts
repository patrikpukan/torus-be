import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/core/prisma/prisma.service";
import { AchievementRepository } from "../repositories/achievement.repository";
import { AppLoggerService } from "src/shared/logger/logger.service";

/**
 * Progress data for an achievement
 */
export interface AchievementProgress {
  achievementId: string;
  currentProgress: number;
  targetProgress: number;
  percentComplete: number;
  isUnlocked: boolean;
}

/**
 * Service for calculating real-time progress towards achievements
 * Handles efficient database queries and caching strategies
 */
@Injectable()
export class AchievementProgressService {
  // Cache with 5-minute TTL for expensive calculations
  private progressCache = new Map<
    string,
    { data: AchievementProgress; timestamp: number }
  >();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly achievementRepository: AchievementRepository,
    private readonly logger: AppLoggerService
  ) {}

  /**
   * Calculate progress for all achievements for a user
   * Returns progress data efficiently, using cache for expensive calculations
   */
  async getUserAchievementProgress(
    userId: string,
    organizationId: string
  ): Promise<AchievementProgress[]> {
    this.logger.debug(
      `Calculating achievement progress for user ${userId}`,
      AchievementProgressService.name
    );

    // Get all achievements
    const achievements = await this.achievementRepository.getAllAchievements();

    // Get user's unlocked achievements
    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
    });

    const unlockedMap = new Map(
      userAchievements
        .filter((ua) => ua.unlockedAt)
        .map((ua) => [ua.achievementId, ua])
    );

    // Calculate progress for each achievement
    const progressList: AchievementProgress[] = [];

    for (const achievement of achievements) {
      const unlockedAt = unlockedMap.get(achievement.id)?.unlockedAt;
      const isUnlocked = !!unlockedAt;

      if (isUnlocked) {
        // Already unlocked, show 100%
        progressList.push({
          achievementId: achievement.id,
          currentProgress: 100,
          targetProgress: 100,
          percentComplete: 100,
          isUnlocked: true,
        });
      } else {
        // Calculate progress based on achievement type
        const progress = await this.calculateProgressForAchievement(
          userId,
          achievement,
          organizationId
        );
        progressList.push(progress);
      }
    }

    return progressList;
  }

  /**
   * Calculate progress for a specific achievement
   * Uses caching to avoid recalculating expensive queries
   */
  private async calculateProgressForAchievement(
    userId: string,
    achievement: any,
    organizationId: string
  ): Promise<AchievementProgress> {
    const cacheKey = `progress:${userId}:${achievement.id}`;

    // Check cache first
    const cached = this.progressCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      this.logger.debug(
        `Cache hit for ${achievement.type} achievement progress`,
        AchievementProgressService.name
      );
      return cached.data;
    }

    let progress: AchievementProgress;

    switch (achievement.type) {
      case "milestone":
        progress = await this.calculateMilestoneProgress(userId, achievement);
        break;

      case "social":
        progress = await this.calculateSocialProgress(userId, achievement);
        break;

      case "engagement":
        progress = await this.calculateEngagementProgress(userId, achievement);
        break;

      case "consistency":
        progress = await this.calculateConsistencyProgress(
          userId,
          achievement,
          organizationId
        );
        break;

      case "legendary":
        progress = await this.calculateLegendaryProgress(userId, achievement);
        break;

      default:
        progress = {
          achievementId: achievement.id,
          currentProgress: 0,
          targetProgress: 1,
          percentComplete: 0,
          isUnlocked: false,
        };
    }

    // Cache the result
    this.progressCache.set(cacheKey, { data: progress, timestamp: Date.now() });

    return progress;
  }

  /**
   * Milestone achievements: First Meeting Completion, Pairing Legend
   * Progress: count of meetings / target count
   */
  private async calculateMilestoneProgress(
    userId: string,
    achievement: any
  ): Promise<AchievementProgress> {
    const meetingCount = await this.achievementRepository.countUserMeetings(
      userId
    );

    // Pairing Legend: 50 meetings
    // First Meeting: 1 meeting
    const targetCount =
      achievement.name === "Pairing Legend" ? 50 : 1;

    return {
      achievementId: achievement.id,
      currentProgress: meetingCount,
      targetProgress: targetCount,
      percentComplete: Math.min(
        Math.round((meetingCount / targetCount) * 100),
        100
      ),
      isUnlocked: false,
    };
  }

  /**
   * Social achievements: Social Butterfly
   * Progress: count of unique partners / target count
   */
  private async calculateSocialProgress(
    userId: string,
    achievement: any
  ): Promise<AchievementProgress> {
    const uniquePartnerCount = await this.achievementRepository.countUniqueMeetingPartners(
      userId
    );

    // Social Butterfly: 20 unique partners
    const targetCount = 20;

    return {
      achievementId: achievement.id,
      currentProgress: uniquePartnerCount,
      targetProgress: targetCount,
      percentComplete: Math.min(
        Math.round((uniquePartnerCount / targetCount) * 100),
        100
      ),
      isUnlocked: false,
    };
  }

  /**
   * Engagement achievements: Bridge Builder
   * Progress: boolean (0 or 1) - has met someone from different department
   */
  private async calculateEngagementProgress(
    userId: string,
    achievement: any
  ): Promise<AchievementProgress> {
    const hasCrossDepartment = await this.achievementRepository.hasMetDifferentDepartment(
      userId
    );

    return {
      achievementId: achievement.id,
      currentProgress: hasCrossDepartment ? 1 : 0,
      targetProgress: 1,
      percentComplete: hasCrossDepartment ? 100 : 0,
      isUnlocked: false,
    };
  }

  /**
   * Consistency achievements: Regular Participant
   * Progress: consecutive cycles / target cycles
   */
  private async calculateConsistencyProgress(
    userId: string,
    achievement: any,
    organizationId: string
  ): Promise<AchievementProgress> {
    // First try to get from CycleParticipation table (new tracking)
    let consecutiveCount = 0;

    // Try the new cycle participation tracking first
    // This will be populated by the pairing algorithm
    try {
      const cycleParticipation = await (this.prisma as any).cycleParticipation?.findUnique?.(
        {
          where: {
            userId_organizationId: { userId, organizationId },
          },
        }
      );

      if (cycleParticipation) {
        consecutiveCount = cycleParticipation.consecutiveCount || 0;
      }
    } catch (error) {
      // CycleParticipation table may not exist yet, fall back to old calculation
      this.logger.debug(
        `CycleParticipation table not available, using fallback calculation for user ${userId}`
      );
    }

    // Fallback to old calculation if not yet tracked
    if (consecutiveCount === 0) {
      consecutiveCount = await this.achievementRepository.countConsecutivePairingCycles(
        userId
      );
    }

    // Regular Participant: 10 consecutive cycles
    const targetCount = 10;

    return {
      achievementId: achievement.id,
      currentProgress: consecutiveCount,
      targetProgress: targetCount,
      percentComplete: Math.min(
        Math.round((consecutiveCount / targetCount) * 100),
        100
      ),
      isUnlocked: false,
    };
  }

  /**
   * Legendary achievements: placeholder for future legendary achievements
   */
  private async calculateLegendaryProgress(
    userId: string,
    achievement: any
  ): Promise<AchievementProgress> {
    return {
      achievementId: achievement.id,
      currentProgress: 0,
      targetProgress: 100,
      percentComplete: 0,
      isUnlocked: false,
    };
  }

  /**
   * Clear cache for a specific user (call after significant events)
   */
  clearUserCache(userId: string): void {
    const keysToDelete: string[] = [];
    for (const [key] of this.progressCache) {
      if (key.includes(`:${userId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.progressCache.delete(key));
    this.logger.debug(
      `Cleared ${keysToDelete.length} cache entries for user ${userId}`,
      AchievementProgressService.name
    );
  }

  /**
   * Manually invalidate cache for an achievement type
   */
  clearAchievementTypeCache(achievementType: string): void {
    const keysToDelete: string[] = [];
    // Note: This is simplified - would need achievement-type tracking to be fully efficient
    // For now, clear all cache if needed
    if (achievementType === "*") {
      this.progressCache.clear();
      this.logger.debug(
        "Cleared all achievement progress cache",
        AchievementProgressService.name
      );
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.progressCache.size,
      entries: Array.from(this.progressCache.keys()),
    };
  }
}
