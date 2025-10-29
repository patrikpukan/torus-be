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

export type User = {
  id: string;
  organizationId: string;
  email: string;
  username: string;
  displayUsername?: string | null;
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
