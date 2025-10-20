export enum UserRoleEnum {
  superAdmin = 'super_admin',
  orgAdmin = 'org_admin',
  user = 'user',
}

export enum ProfileStatusEnum {
  pending = 'pending',
  active = 'active',
  suspended = 'suspended',
}

export type User = {
  id: string;
  organizationId: string;
  name: string;
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
