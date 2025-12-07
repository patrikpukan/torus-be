import { SupabaseJwtClaims } from "../../../auth/verifySupabaseJwt";

export interface Identity {
  /**
   * Internal application user identifier.
   * Falls back to Supabase user id if the application user cannot be resolved.
   */
  id: string;
  /**
   * Supabase Auth user identifier (JWT subject).
   */
  supabaseUserId?: string;
  email?: string;
  /**
   * User role from JWT claims (e.g., from Supabase auth).
   * Required for authorization checks and permission evaluation.
   */
  role: string;
  /**
   * Application-level role resolved from the database (e.g. UserRoleEnum).
   */
  appRole?: string;
  /**
   * Organization ID for the current user.
   * Required for org-level authorization checks and feature access.
   */
  organizationId: string;
  rawClaims: SupabaseJwtClaims;
  /**
   * Additional metadata copied from JWT claims (e.g. user metadata).
   */
  metadata?: Record<string, unknown>;
}
