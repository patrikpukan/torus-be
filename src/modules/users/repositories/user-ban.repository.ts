import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/core/prisma/prisma.service";
import { UserBan } from "../domain/user-ban";

type PrismaClientOrTx = Prisma.TransactionClient | PrismaService;

type PrismaBanEntity = Prisma.BanGetPayload<Prisma.BanDefaultArgs>;

const mapEntityToDomain = (ban: PrismaBanEntity): UserBan => {
  if (!ban.userId) {
    throw new Error(`Ban ${ban.id} is missing user reference`);
  }

  if (!ban.reason) {
    throw new Error(`Ban ${ban.id} is missing reason`);
  }

  return {
    id: ban.id,
    userId: ban.userId,
    organizationId: ban.organizationId ?? null,
    reason: ban.reason,
    bannedById: ban.bannedById ?? null,
    createdAt: ban.createdAt,
    expiresAt: ban.expiresAt ?? null,
  };
};

@Injectable()
export class UserBanRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient): PrismaClientOrTx {
    return tx ?? this.prisma;
  }

  private buildActiveBanWhere(userIds?: string[]): Prisma.BanWhereInput {
    const now = new Date();
    const where: Prisma.BanWhereInput = {
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    if (userIds && userIds.length > 0) {
      where.userId = { in: userIds };
    }

    return where;
  }

  async createBan(
    data: {
      userId: string;
      organizationId?: string | null;
      reason: string;
      expiresAt?: Date | null;
      bannedById?: string | null;
    },
    tx?: Prisma.TransactionClient
  ): Promise<UserBan> {
    const client = this.getClient(tx);
    const created = await client.ban.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId ?? null,
        reason: data.reason,
        expiresAt: data.expiresAt ?? null,
        bannedById: data.bannedById ?? null,
      },
    });

    return mapEntityToDomain(created);
  }

  async findActiveBanByUserId(
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<UserBan | null> {
    const client = this.getClient(tx);
    const ban = await client.ban.findFirst({
      where: this.buildActiveBanWhere([userId]),
      orderBy: { createdAt: "desc" },
    });

    return ban ? mapEntityToDomain(ban) : null;
  }

  async findActiveBansByUserIds(
    userIds: string[],
    tx?: Prisma.TransactionClient
  ): Promise<Map<string, UserBan>> {
    const client = this.getClient(tx);

    if (!userIds.length) {
      return new Map();
    }

    const bans = await client.ban.findMany({
      where: this.buildActiveBanWhere(userIds),
      orderBy: { createdAt: "desc" },
    });

    const map = new Map<string, UserBan>();

    for (const ban of bans) {
      if (ban.userId && !map.has(ban.userId)) {
        map.set(ban.userId, mapEntityToDomain(ban));
      }
    }

    return map;
  }
}
