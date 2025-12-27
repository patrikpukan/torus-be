import { Query, Resolver, Args, Parent, ResolveField } from "@nestjs/graphql";
import { UseGuards, ForbiddenException } from "@nestjs/common";
import type { Identity } from "src/shared/auth/domain/identity";
import {
  AchievementType,
  UserAchievementType,
  AchievementWithProgressType,
  AchievementStatisticsType,
  AchievementPointsStatisticsType,
} from "../graphql/types/achievement.type";
import { AchievementsService } from "../services/achievements.service";
import { AuthenticatedUserGuard } from "src/shared/auth/guards/authenticated-user.guard";
import { User } from "src/shared/auth/decorators/user.decorator";
import { CaslAbilityFactory } from "src/shared/auth/casl/casl-ability.factory";
import { UserRoleEnum } from "src/modules/users/domain/user";
import { PrismaService } from "src/core/prisma/prisma.service";

/**
 * Achievements Resolver
 *
 * Provides GraphQL queries for achievement data with CASL-based authorization.
 * - Users can query their own achievements
 * - Org admins can query achievements for users in their organization
 * - Super admins have full access
 *
 * Authorization is enforced at the query level using CASL abilities.
 */
@Resolver()
export class AchievementsResolver {
  constructor(
    private readonly achievementsService: AchievementsService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Get all achievements with current user's unlock status and progress
   *
   * Returns a list of all achievements along with the current user's
   * progress and unlock status for each achievement.
   *
   * Authorization: Any authenticated user (can see their own achievements)
   */
  @Query(() => [AchievementWithProgressType], {
    description: "Get all achievements with current user's unlock status and progress",
  })
  @UseGuards(AuthenticatedUserGuard)
  async achievements(
    @User() identity: Identity
  ): Promise<AchievementWithProgressType[]> {
    // User can only see their own achievements
    const progress = await this.achievementsService.getUserAchievementProgress(
      identity,
      identity.id
    );

    return progress.map((p) => ({
      achievementId: p.achievementId,
      name: p.achievementName,
      description: p.achievementDescription,
      imageIdentifier: p.achievementImageIdentifier,
      type: p.achievementType as any,
      pointValue: p.pointValue,
      isUnlocked: p.isUnlocked,
      unlockedAt: p.unlockedAt,
      currentProgress: p.currentProgress,
      targetProgress: p.targetProgress,
      percentComplete: p.percentComplete,
    }));
  }

  /**
   * Get a specific user's unlocked achievements
   *
   * Returns only the achievements that have been unlocked by the specified user.
   * Used for displaying achievements on user profiles.
   *
   * Authorization:
   * - Users can view their own unlocked achievements
   * - Org admins can view unlocked achievements of users in their organization
   * - Super admins can view any user's achievements
   */
  @Query(() => [UserAchievementType], {
    description: "Get a specific user's unlocked achievements",
  })
  @UseGuards(AuthenticatedUserGuard)
  async userAchievements(
    @User() identity: Identity,
    @Args("userId") userId: string
  ): Promise<UserAchievementType[]> {
    // Check CASL ability
    const ability = this.caslAbilityFactory.createForUser(identity);
    const canViewUserAchievements = ability.can("read", "User");

    if (!canViewUserAchievements) {
      // Additional check: can they view this specific user?
      const isSelfView = identity.id === userId;
      const isOrgAdmin = identity.appRole === UserRoleEnum.org_admin;

      if (!isSelfView && !isOrgAdmin) {
        throw new ForbiddenException(
          "You do not have permission to view this user's achievements"
        );
      }

      // If org admin, verify user is in same organization
      if (isOrgAdmin) {
        const targetUser = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true },
        });

        const currentUser = await this.prisma.user.findUnique({
          where: { id: identity.id },
          select: { organizationId: true },
        });

        if (targetUser?.organizationId !== currentUser?.organizationId) {
          throw new ForbiddenException(
            "You can only view achievements for users in your organization"
          );
        }
      }
    }

    // Get unlocked achievements only
    const userAchievements = await this.achievementsService.getUserAchievements(
      identity,
      userId
    );

    return userAchievements
      .filter((ua) => ua.unlockedAt !== undefined)
      .map((ua) => ({
        id: ua.id,
        achievement: ua.achievement,
        unlockedAt: ua.unlockedAt,
        currentProgress: ua.currentProgress,
        notificationSent: ua.notificationSent,
        createdAt: ua.createdAt,
        updatedAt: ua.updatedAt,
      }));
  }

  /**
   * Get organization-wide achievement statistics
   *
   * Returns statistics about achievements unlocked within an organization,
   * including which users have unlocked each achievement.
   *
   * Authorization: Only org_admin and super_admin users can access this
   */
  @Query(() => [AchievementStatisticsType], {
    description:
      "Get organization-wide achievement statistics (org_admin only)",
  })
  @UseGuards(AuthenticatedUserGuard)
  async organizationAchievementStatistics(
    @User() identity: Identity,
    @Args("organizationId") organizationId: string
  ): Promise<AchievementStatisticsType[]> {
    // CASL authorization check
    const ability = this.caslAbilityFactory.createForUser(identity);

    // Only org_admin and super_admin can view organization statistics
    const isOrgAdmin = identity.appRole === UserRoleEnum.org_admin;
    const isSuperAdmin = identity.appRole === UserRoleEnum.super_admin;

    if (!isOrgAdmin && !isSuperAdmin) {
      throw new ForbiddenException(
        "Only organization administrators can view achievement statistics"
      );
    }

    // Verify org admin is part of the organization
    if (isOrgAdmin && !isSuperAdmin) {
      const adminUser = await this.prisma.user.findUnique({
        where: { id: identity.id },
        select: { organizationId: true },
      });

      if (adminUser?.organizationId !== organizationId) {
        throw new ForbiddenException(
          "You can only view statistics for your organization"
        );
      }
    }

    // Get and return organization statistics
    const stats = await this.achievementsService.getOrganizationAchievementStats(
      identity,
      organizationId
    );

    return stats.map((stat) => ({
      achievement: stat.achievement,
      unlockedByCount: stat.unlockedByCount,
      users: stat.users.map((user) => ({
        userId: user.userId,
        email: user.email,
        name: user.name,
        unlockedAt: user.unlockedAt || undefined,
      })),
    }));
  }

  /**
   * Get all available achievements (without user-specific data)
   *
   * Returns a list of all active achievements in the system.
   * Useful for displaying achievement catalogs.
   *
   * Authorization: Any authenticated user
   */
  @Query(() => [AchievementType], {
    description: "Get all available achievements",
  })
  @UseGuards(AuthenticatedUserGuard)
  async allAchievements(): Promise<AchievementType[]> {
    const achievements = await this.achievementsService.getUserAchievements(
      { id: "public", appRole: "user" } as Identity,
      "public"
    );
    return achievements.map((ua) => ua.achievement);
  }

  /**
   * Get user achievement points statistics
   *
   * Returns the total points earned by a user from unlocked achievements
   * and the total possible points available.
   *
   * Authorization: Users can view their own stats, org admins can view their org members
   */
  @Query(() => AchievementPointsStatisticsType, {
    description: "Get user's earned points from achievements",
  })
  @UseGuards(AuthenticatedUserGuard)
  async userAchievementPoints(
    @User() identity: Identity,
    @Args("userId", { nullable: true }) userId?: string
  ): Promise<AchievementPointsStatisticsType> {
    const targetUserId = userId || identity.id;

    // Authorization check
    if (targetUserId !== identity.id && identity.appRole === UserRoleEnum.user) {
      throw new ForbiddenException(
        "You can only view your own achievement points"
      );
    }

    // If org admin, verify user is in same organization
    if (identity.appRole === UserRoleEnum.org_admin) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { organizationId: true },
      });

      const currentUser = await this.prisma.user.findUnique({
        where: { id: identity.id },
        select: { organizationId: true },
      });

      if (targetUser?.organizationId !== currentUser?.organizationId) {
        throw new ForbiddenException(
          "You can only view points for users in your organization"
        );
      }
    }

    const earnedPoints = await this.achievementsService.getTotalEarnedPoints(
      targetUserId
    );
    const possiblePoints = await this.achievementsService.getTotalPossiblePoints();

    return {
      earnedPoints,
      possiblePoints,
      completionPercentage: possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0,
    };
  }
}
