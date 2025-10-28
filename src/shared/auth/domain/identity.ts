import { SupabaseJwtClaims } from "../../../auth/verifySupabaseJwt";

export interface Identity {
  id: string;
  email?: string;
  role?: string;
  rawClaims: SupabaseJwtClaims;
  /**
   * Additional metadata copied from JWT claims (e.g. user metadata).
   */
  metadata?: Record<string, unknown>;
}
