export enum MeetingConfirmationStatus {
  pending = "pending",
  confirmed = "confirmed",
  rejected = "rejected",
  proposed = "proposed",
}

export type MeetingEvent = {
  id: string;
  pairingId?: string | null;
  userAId: string;
  userBId: string;
  createdByUserId: string;
  startDateTime: Date;
  endDateTime: Date;
  userAConfirmationStatus: string; // MeetingConfirmationStatus value
  userBConfirmationStatus: string; // MeetingConfirmationStatus value
  userAProposedStartDateTime?: Date | null;
  userAProposedEndDateTime?: Date | null;
  userBProposedStartDateTime?: Date | null;
  userBProposedEndDateTime?: Date | null;
  userANote?: string | null;
  userBNote?: string | null;
  cancelledAt?: Date | null;
  cancelledByUserId?: string | null;
  cancellationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateMeetingEventInput = {
  pairingId?: string;
  userAId: string;
  userBId: string;
  createdByUserId: string;
  startDateTime: Date;
  endDateTime: Date;
  note?: string; // optional creator note stored as userANote/userBNote
};

export type UpdateMeetingEventConfirmationInput = {
  meetingId: string;
  userId: string; // Who is confirming/rejecting/proposing
  status: MeetingConfirmationStatus | string;
  proposedStartDateTime?: Date | null;
  proposedEndDateTime?: Date | null;
  note?: string | null;
};

export type CancelMeetingEventInput = {
  meetingId: string;
  cancelledByUserId: string;
  reason?: string;
};
