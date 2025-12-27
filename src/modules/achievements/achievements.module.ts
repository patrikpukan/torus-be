import { Module } from "@nestjs/common";
import { AchievementRepository } from "./repositories/achievement.repository";
import { AchievementsService } from "./services/achievements.service";
import { AchievementProgressService } from "./services/achievement-progress.service";
import { AchievementsResolver } from "./resolvers/achievements.resolver";
import { LoggerModule } from "../../shared/logger/logger.module";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { AuthModule } from "../../shared/auth/auth.module";

@Module({
  imports: [LoggerModule, PrismaModule, AuthModule],
  providers: [
    AchievementRepository,
    AchievementProgressService,
    AchievementsService,
    AchievementsResolver,
  ],
  exports: [AchievementsService, AchievementRepository, AchievementProgressService],
})
export class AchievementsModule {}
