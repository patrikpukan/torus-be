import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
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

  private async getEligibleUsers(
    organizationId: string,
    periodId: string,
  ): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { suspendedUntil: null },
          { suspendedUntil: { lt: new Date() } },
        ],
        pairingsAsUserA: {
          none: { periodId },
        },
        pairingsAsUserB: {
          none: { periodId },
        },
      },
    });
  }
}
