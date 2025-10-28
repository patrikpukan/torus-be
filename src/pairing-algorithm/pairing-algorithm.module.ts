import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { LoggerModule } from '../shared/logger/logger.module';
import { PairingAlgorithmService } from './pairing-algorithm.service';

@Module({
  imports: [PrismaModule, LoggerModule],
  providers: [PairingAlgorithmService],
  exports: [PairingAlgorithmService],
})
export class PairingAlgorithmModule {}
