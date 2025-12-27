import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { LoggerModule } from "../../shared/logger/logger.module";
import { AuthModule } from "../../shared/auth/auth.module";
import { PairingAlgorithmService } from "./pairing-algorithm.service";
import { PairingAlgorithmResolver } from "./pairing-algorithm.resolver";
import { AlgorithmSettingsResolver } from "./algorithm-settings.resolver";
import { AlgorithmSettingsService } from "./services/algorithm-settings.service";
import { PairingAlgorithmConfig } from "./pairing-algorithm.config";
import { PairingAlgorithmRepository } from "./repositories/pairing-algorithm.repository";
import { CycleParticipationRepository } from "./repositories/cycle-participation.repository";
import { CycleManagementService } from "./services/cycle-management.service";
import { AchievementParticipationService } from "./services/achievement-participation.service";
import { AchievementsModule } from "../achievements/achievements.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    LoggerModule,
    AuthModule,
    AchievementsModule,
  ],
  providers: [
    PairingAlgorithmConfig,
    PairingAlgorithmRepository,
    CycleParticipationRepository,
    CycleManagementService,
    AchievementParticipationService,
    PairingAlgorithmService,
    AlgorithmSettingsService,
    PairingAlgorithmResolver,
    AlgorithmSettingsResolver,
  ],
  exports: [PairingAlgorithmService],
})
export class PairingAlgorithmModule {}
