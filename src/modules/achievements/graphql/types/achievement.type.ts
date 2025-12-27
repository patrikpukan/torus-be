import { ObjectType, Field, Int, registerEnumType } from "@nestjs/graphql";
import { AchievementType as PrismaAchievementType } from "@prisma/client";

export enum AchievementTypeEnum {
  milestone = "milestone",
  social = "social",
  engagement = "engagement",
  consistency = "consistency",
  legendary = "legendary",
}

registerEnumType(AchievementTypeEnum, {
  name: "AchievementType",
  description: "Types of achievements",
});

/**
 * Basic achievement information
 * Shared across all achievement queries
 */
@ObjectType("Achievement")
export class AchievementType {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field()
  imageIdentifier: string;

  @Field(() => AchievementTypeEnum)
  type: PrismaAchievementType;

  @Field(() => Int)
  pointValue: number;

  @Field()
  isActive: boolean;

  @Field(() => String, { nullable: true })
  unlockCondition?: string | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

/**
 * Achievement with user-specific unlock status and progress
 * Returned when querying a specific user's achievements
 */
@ObjectType("UserAchievement")
export class UserAchievementType {
  @Field()
  id: string;

  @Field(() => AchievementType)
  achievement: AchievementType;

  @Field({ nullable: true })
  unlockedAt?: Date;

  @Field(() => Int)
  currentProgress: number;

  @Field()
  notificationSent: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

/**
 * Achievement with progress tracking
 * Extends Achievement with unlock status, progress, and target information
 * Used for dashboard and profile views
 */
@ObjectType("AchievementWithProgress")
export class AchievementWithProgressType {
  @Field()
  achievementId: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field()
  imageIdentifier: string;

  @Field(() => AchievementTypeEnum)
  type: PrismaAchievementType;

  @Field(() => Int)
  pointValue: number;

  @Field()
  isUnlocked: boolean;

  @Field({ nullable: true })
  unlockedAt?: Date;

  @Field(() => Int)
  currentProgress: number;

  @Field(() => Int)
  targetProgress: number;

  @Field(() => Int)
  percentComplete: number;
}

/**
 * Achievement progress view (internal use)
 * Used by resolvers to return progress information
 */
@ObjectType("AchievementProgress")
export class AchievementProgressType {
  @Field()
  achievementId: string;

  @Field()
  achievementName: string;

  @Field()
  achievementType: string;

  @Field(() => Int)
  currentProgress: number;

  @Field(() => Int)
  targetProgress: number;

  @Field()
  isUnlocked: boolean;

  @Field({ nullable: true })
  unlockedAt?: Date;

  @Field(() => Int)
  percentComplete: number;
}

/**
 * Organization-wide achievement statistics
 * Visible only to org admins
 */
@ObjectType("AchievementStatistics")
export class AchievementStatisticsType {
  @Field(() => AchievementType)
  achievement: AchievementType;

  @Field(() => Int)
  unlockedByCount: number;

  @Field(() => [AchievementUnlockerType])
  users: AchievementUnlockerType[];
}

@ObjectType("AchievementUnlocker")
export class AchievementUnlockerType {
  @Field()
  userId: string;

  @Field()
  email: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  unlockedAt?: Date;
}

/**
 * User achievement points statistics
 * Shows earned vs possible points
 */
@ObjectType("AchievementPointsStatistics")
export class AchievementPointsStatisticsType {
  @Field(() => Int)
  earnedPoints: number;

  @Field(() => Int)
  possiblePoints: number;

  @Field(() => Int)
  completionPercentage: number;
}
