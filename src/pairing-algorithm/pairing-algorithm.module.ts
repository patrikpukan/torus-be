import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../core/prisma/prisma.module';
import { LoggerModule } from '../shared/logger/logger.module';
import { PairingAlgorithmService } from './pairing-algorithm.service';
import { PairingAlgorithmResolver } from './pairing-algorithm.resolver';
import { AlgorithmSettingsResolver } from './algorithm-settings.resolver';
import { PairingAlgorithmConfig } from './pairing-algorithm.config';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, LoggerModule],
  providers: [PairingAlgorithmConfig, PairingAlgorithmService, PairingAlgorithmResolver, AlgorithmSettingsResolver],
  exports: [PairingAlgorithmService],
})
export class PairingAlgorithmModule {}
