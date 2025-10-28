import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { AppLoggerService } from '../shared/logger/logger.service';

@Injectable()
export class PairingAlgorithmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
  ) {}

  async executePairing(organizationId: string): Promise<void> {
    this.logger.log(
      `Pairing algorithm started for organization: ${organizationId}`,
      PairingAlgorithmService.name,
    );
  }
}
