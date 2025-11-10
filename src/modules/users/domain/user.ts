export enum UserRoleEnum {
  super_admin = "super_admin",
  org_admin = "org_admin",
  user = "user",
}

export enum ProfileStatusEnum {
  pending = "pending",
  active = "active",
  suspended = "suspended",
}

import { UserBan } from "./user-ban";

export type User = {
  id: string;
  organizationId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  about?: string | null;
  hobbies?: string | null;
  interests?: string | null;
  preferredActivity?: string | null;
  profileImageUrl?: string | null;
  supabaseUserId?: string | null;
  isActive: boolean;
  suspendedUntil?: Date | null;
  role: UserRoleEnum;
  profileStatus: ProfileStatusEnum;
  createdAt: Date;
  updatedAt: Date;
  activeBan?: UserBan | null;
};

export type UserOrganization = {
  id: string;
  name: string;
  code: string;
  imageUrl?: string | null;
};
export type CurrentUser = User & {
  organization: UserOrganization;
};
