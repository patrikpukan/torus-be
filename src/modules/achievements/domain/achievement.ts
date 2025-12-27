import { AchievementType } from "@prisma/client";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  imageIdentifier: string;
  type: AchievementType;
  pointValue: number;
  isActive: boolean;
  unlockCondition: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAchievementView {
  id: string;
  achievement: Achievement;
  unlockedAt?: Date;
  currentProgress: number;
  notificationSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AchievementProgressView {
  achievementId: string;
  achievementName: string;
  achievementType: string;
  currentProgress: number;
  targetProgress: number;
  isUnlocked: boolean;
  unlockedAt?: Date;
  percentComplete: number;
}

export type AchievementUnlockEvent = 
  | { type: "meeting_completed"; userId: string; meetingEventId: string }
  | { type: "pairing_completed"; userId: string; pairingId: string }
  | { type: "rating_submitted"; userId: string; meetingEventId: string }
  | { type: "cycle_completed"; userId: string; pairingPeriodId: string };
