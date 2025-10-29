import type { Prisma, PrismaClient } from "@prisma/client";
import type { SupabaseJwtClaims } from "../auth/verifySupabaseJwt";

export type PrismaTransactionClient = Prisma.TransactionClient;

export async function withRls<T>(
  prisma: PrismaClient,
  claims: SupabaseJwtClaims,
  callback: (tx: PrismaTransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    if (!claims?.sub) {
      throw new Error("Supabase claims must include subject for RLS");
    }

    const serializedClaims = JSON.stringify(claims);

    // Set JWT claims for RLS policy evaluation
    await tx.$executeRaw`select set_config('request.jwt.claims', ${serializedClaims}, true)`;

    return callback(tx);
  });
}
