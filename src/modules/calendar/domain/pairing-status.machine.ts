import type { MeetingEvent } from "./meeting-event";

export type DerivedPairingStatus =
  | "planned"
  | "matched"
  | "met"
  | "not_met"
  | "not_planned"
  | "unspecified"
  | "cancelled";

/**
 * Compute a derived pairing status from the latest meeting and current time.
 * Does not mutate DB; intended for read-time mapping for UI/analytics.
 */
export function computeDerivedPairingStatus(args: {
  pairingStatus?: string; // current stored status (optional)
  latestMeeting: MeetingEvent | null;
  now?: Date;
}): DerivedPairingStatus {
  const { pairingStatus, latestMeeting } = args;
  const now = args.now ?? new Date();

  // Honor explicit cancellation
  if (pairingStatus === "cancelled") return "cancelled";

  // No meeting or active meeting? -> not_planned
  if (!latestMeeting || latestMeeting.cancelledAt) {
    return "not_planned";
  }

  const start = latestMeeting.startDateTime;
  const end = latestMeeting.endDateTime;
  const a = String(latestMeeting.userAConfirmationStatus);
  const b = String(latestMeeting.userBConfirmationStatus);
  const bothConfirmed = a === "confirmed" && b === "confirmed";
  const anyRejected = a === "rejected" || b === "rejected";

  if (bothConfirmed) {
    if (now < start) return "planned";
    if (now >= end) return "met";
    // In-progress meeting window: still considered planned
    return "planned";
  }

  if (anyRejected) {
    // Only label as not_met after the planned time passes
    if (now >= end) return "not_met";
    return "matched";
  }

  // Neither confirmed nor rejected
  if (now >= end) return "unspecified";

  // Default for active pairing without a concluded result
  return "matched";
}

