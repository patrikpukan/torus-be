import type { Prisma } from "@prisma/client";

export const getBlockedUserIdsForUser = async (
  userId: string,
  tx: Prisma.TransactionClient
): Promise<Set<string>> => {
  const blocks = await tx.userBlock.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: {
      blockerId: true,
      blockedId: true,
    },
  });

  const blockedUserIds = new Set<string>();
  blocks.forEach((block) => {
    if (block.blockerId === userId) {
      blockedUserIds.add(block.blockedId);
    }
    if (block.blockedId === userId) {
      blockedUserIds.add(block.blockerId);
    }
  });

  return blockedUserIds;
};
