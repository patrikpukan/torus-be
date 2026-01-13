import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PairingPeriodStatus, PairingStatus, Prisma } from "@prisma/client";
import { PrismaService } from "src/core/prisma/prisma.service";
import { withRls } from "src/db/withRls";
import { getRlsClaims } from "src/shared/auth/utils/get-rls-claims";
import type { Identity } from "src/shared/auth/domain/identity";
import { getBlockedUserIdsForUser } from "../utils/user-blocks";

@Injectable()
export class IdealColleagueService {
  constructor(private readonly prisma: PrismaService) {}

  async findIdealColleague(identity: Identity): Promise<string> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: identity.id },
        include: {
          userTags: {
            include: { tag: true },
          },
        },
      });

      if (!currentUser) {
        throw new NotFoundException("User not found");
      }

      const usesRemaining = currentUser.idealColleagueUsesRemaining ?? 0;

      if (usesRemaining <= 0) {
        throw new BadRequestException(
          "You have reached the limit for ideal colleague matches."
        );
      }

      const [blockedUserIds, pairedUserIds] = await Promise.all([
        getBlockedUserIdsForUser(identity.id, tx),
        this.getPairedUserIdsForUser(identity.id, tx),
      ]);

      const excludedIds = [
        identity.id,
        ...Array.from(blockedUserIds),
        ...Array.from(pairedUserIds),
      ];

      const candidates = await tx.user.findMany({
        where: {
          organizationId: currentUser.organizationId,
          id: { notIn: excludedIds },
          isActive: true,
          role: "user",
          OR: [
            { suspendedUntil: null },
            { suspendedUntil: { lt: new Date() } },
          ],
        },
        include: {
          userTags: {
            include: { tag: true },
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      if (candidates.length === 0) {
        throw new NotFoundException("No available colleagues to match with.");
      }

      const currentInterestIds = new Set(
        currentUser.userTags.map((ut) => ut.tag.id)
      );

      let bestCandidate = candidates[0];
      let bestCommonCount = -1;

      for (const candidate of candidates) {
        let commonCount = 0;

        if (currentInterestIds.size > 0) {
          for (const userTag of candidate.userTags) {
            if (currentInterestIds.has(userTag.tag.id)) {
              commonCount += 1;
            }
          }
        }

        if (commonCount > bestCommonCount) {
          bestCommonCount = commonCount;
          bestCandidate = candidate;
        }
      }

      let activePeriod = await tx.pairingPeriod.findFirst({
        where: {
          organizationId: currentUser.organizationId,
          status: PairingPeriodStatus.active,
        },
        orderBy: { startDate: "desc" },
      });

      if (!activePeriod) {
        const setting = await tx.algorithmSetting.findUnique({
          where: { organizationId: currentUser.organizationId },
          select: { periodLengthDays: true },
        });

        const periodLengthDays =
          setting?.periodLengthDays && setting.periodLengthDays > 0
            ? setting.periodLengthDays
            : 21;

        const startDate = new Date();
        const endDate = new Date(
          startDate.getTime() + periodLengthDays * 24 * 60 * 60 * 1000
        );

        activePeriod = await tx.pairingPeriod.create({
          data: {
            organizationId: currentUser.organizationId,
            status: PairingPeriodStatus.active,
            startDate,
            endDate,
          },
        });
      }

      const pairing = await tx.pairing.create({
        data: {
          periodId: activePeriod.id,
          organizationId: currentUser.organizationId,
          userAId: identity.id,
          userBId: bestCandidate.id,
          status: PairingStatus.matched,
          createdAt: new Date(),
        },
        select: { id: true },
      });

      await tx.message.create({
        data: {
          pairingId: pairing.id,
          senderId: identity.id,
          content:
            "System: You are an ideal match. Start the conversation and set up a meeting.",
        },
      });

      await tx.user.update({
        where: { id: identity.id },
        data: { idealColleagueUsesRemaining: { decrement: 1 } },
        select: { idealColleagueUsesRemaining: true },
      });

      return pairing.id;
    });
  }

  private async getPairedUserIdsForUser(
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<Set<string>> {
    const pairings = await tx.pairing.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: {
        userAId: true,
        userBId: true,
      },
    });

    const pairedUserIds = new Set<string>();
    pairings.forEach((pairing) => {
      const partnerId =
        pairing.userAId === userId ? pairing.userBId : pairing.userAId;
      pairedUserIds.add(partnerId);
    });

    return pairedUserIds;
  }
}
