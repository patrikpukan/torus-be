import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { LoggerModule } from '../shared/logger/logger.module';
import { PairingAlgorithmService } from './pairing-algorithm.service';
import { PairingAlgorithmResolver } from './pairing-algorithm.resolver';
import { AlgorithmSettingsResolver } from './algorithm-settings.resolver';

@Module({
  imports: [PrismaModule, LoggerModule],
  providers: [PairingAlgorithmService, PairingAlgorithmResolver, AlgorithmSettingsResolver],
  exports: [PairingAlgorithmService],
})
export class PairingAlgorithmModule {}
