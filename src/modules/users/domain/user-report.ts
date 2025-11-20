export type UserReport = {
  id: string;
  reporterId: string;
  reportedUserId: string;
  pairingId: string;
  reason: string;
  createdAt: Date;
};

