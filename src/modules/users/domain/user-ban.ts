export type UserBan = {
  id: string;
  userId: string;
  organizationId?: string | null;
  reason: string;
  bannedById?: string | null;
  createdAt: Date;
  expiresAt?: Date | null;
};
