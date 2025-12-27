import { PrismaService } from "../../../core/prisma/prisma.service";

interface AchievementConfig {
  name: string;
  description: string;
  imageIdentifier: string;
  type: "milestone" | "social" | "engagement" | "consistency" | "legendary";
  pointValue: number;
  unlockCondition?: string;
}

const ACHIEVEMENTS: AchievementConfig[] = [
  {
    name: "Newcomer",
    description: "Completed your first successful pairing and meeting",
    imageIdentifier: "newcomer",
    type: "milestone",
    pointValue: 10,
    unlockCondition: "Complete first meeting with pairing",
  },
  {
    name: "Social Butterfly",
    description: "Met with 10 different people",
    imageIdentifier: "social-butterfly",
    type: "social",
    pointValue: 50,
    unlockCondition: "Complete 10 meetings with different users",
  },
  {
    name: "Bridge Builder",
    description: "Connected with someone from a different department",
    imageIdentifier: "bridge-builder",
    type: "social",
    pointValue: 25,
    unlockCondition: "Complete meeting with user from different department",
  },
  {
    name: "Regular Participant",
    description: "Participated in 10 consecutive pairing cycles",
    imageIdentifier: "regular-participant",
    type: "consistency",
    pointValue: 40,
    unlockCondition: "Participate in 10 consecutive pairing cycles",
  },
  {
    name: "Pairing Legend",
    description: "Completed 50 meetings total",
    imageIdentifier: "pairing-legend",
    type: "legendary",
    pointValue: 100,
    unlockCondition: "Complete 50 total meetings",
  },
];

/**
 * Seeds initial achievements into the database
 * Idempotent: uses upsert to avoid duplicates
 * @param prisma - Prisma client instance
 * @returns Promise<void>
 */
export const createAchievements = async (prisma: PrismaService): Promise<void> => {
  console.log("🏆 Creating achievements...");

  try {
    let createdCount = 0;

    for (const achievement of ACHIEVEMENTS) {
      const result = await prisma.achievement.upsert({
        where: { name: achievement.name },
        update: {
          description: achievement.description,
          imageIdentifier: achievement.imageIdentifier,
          type: achievement.type,
          pointValue: achievement.pointValue,
          unlockCondition: achievement.unlockCondition,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          name: achievement.name,
          description: achievement.description,
          imageIdentifier: achievement.imageIdentifier,
          type: achievement.type,
          pointValue: achievement.pointValue,
          unlockCondition: achievement.unlockCondition,
          isActive: true,
        },
      });

      console.log(`  ✓ Achievement: ${result.name} (${result.type})`);
      createdCount++;
    }

    console.log(`✅ Created/updated ${createdCount} achievements`);
  } catch (error) {
    console.error("❌ Error creating achievements:", error);
    throw error;
  }
};
