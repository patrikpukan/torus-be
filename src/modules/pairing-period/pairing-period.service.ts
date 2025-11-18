import { ForbiddenException, Injectable } from "@nestjs/common";
import type { Identity } from "../../shared/auth/domain/identity";
import { PrismaService } from "../../core/prisma/prisma.service";
import { PairingPeriodRepository } from "./pairing-period.repository";

@Injectable()
export class PairingPeriodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pairingPeriodRepository: PairingPeriodRepository
  ) {}

  async getActivePairingPeriodForUser(user: Identity | null) {
    if (!user?.id) {
      throw new ForbiddenException("Authenticated user context is missing");
    }

    const organizationId =
      user.organizationId ?? (await this.findOrganizationId(user.id));

    if (!organizationId) {
      return null;
    }

    return this.pairingPeriodRepository.findLatestActiveByOrganization(
      organizationId
    );
  }

  private async findOrganizationId(userId: string): Promise<string | null> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    return dbUser?.organizationId ?? null;
  }
}
