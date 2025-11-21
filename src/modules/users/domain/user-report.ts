import { UserType } from "../graphql/types/user.type";

export enum ReportStatusEnum {
  pending = "pending",
  resolved = "resolved",
}

export type UserReport = {
  id: string;
  reporterId: string;
  reportedUserId: string;
  pairingId: string;
  reason: string;
  createdAt: Date;
  status: ReportStatusEnum;
  reporter: UserType;
  reportedUser: UserType;
  resolvedBy?: UserType | null;
  resolutionNote?: string | null;
  resolvedAt?: Date | null;
};
