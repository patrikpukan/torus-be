export type UserBan = {
  id: string;
  userId: string;
  organizationId: string;
  reason: string;
  bannedById: string;
  createdAt: Date;
  expiresAt?: Date | null;
};
