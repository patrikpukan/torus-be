import type { SupabaseJwtClaims } from "../../../auth/verifySupabaseJwt";
import { Identity } from "../domain/identity";

export const getRlsClaims = (identity: Identity): SupabaseJwtClaims => {
  const claims: SupabaseJwtClaims = {
    ...(identity.rawClaims ?? {}),
    sub: identity.supabaseUserId ?? identity.id,
  };

  if (!claims.role) {
    claims.role = identity.role ?? "authenticated";
  }

  if (identity.email && typeof claims.email !== "string") {
    claims.email = identity.email;
  }

  return claims;
};
