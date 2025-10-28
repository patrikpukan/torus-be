import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@applifting-io/nestjs-decorated-config';
import { PrismaModule } from '../core/prisma/prisma.module';
import { LoggerModule } from '../shared/logger/logger.module';
import { PairingAlgorithmService } from './pairing-algorithm.service';
import { PairingAlgorithmResolver } from './pairing-algorithm.resolver';
import { AlgorithmSettingsResolver } from './algorithm-settings.resolver';

@Module({
  imports: [ConfigModule, PrismaModule, LoggerModule, ScheduleModule.forRoot()],
  providers: [PairingAlgorithmService, PairingAlgorithmResolver, AlgorithmSettingsResolver],
  exports: [PairingAlgorithmService],
})
export class PairingAlgorithmModule {}
