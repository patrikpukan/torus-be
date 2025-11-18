import { Injectable } from "@nestjs/common";
import { PairingPeriodStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../core/prisma/prisma.service";

@Injectable()
export class PairingPeriodRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLatestActiveByOrganization(
    organizationId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx ?? this.prisma;

    return client.pairingPeriod.findFirst({
      where: {
        organizationId,
        status: PairingPeriodStatus.active,
      },
      orderBy: { startDate: "desc" },
    });
  }
}
