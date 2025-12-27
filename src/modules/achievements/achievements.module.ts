import { Module } from "@nestjs/common";
import { AchievementRepository } from "./repositories/achievement.repository";
import { AchievementsService } from "./services/achievements.service";
import { AchievementsResolver } from "./resolvers/achievements.resolver";
import { SharedModule } from "src/shared/shared.module";

@Module({
  imports: [SharedModule],
  providers: [AchievementRepository, AchievementsService, AchievementsResolver],
  exports: [AchievementsService, AchievementRepository],
})
export class AchievementsModule {}
