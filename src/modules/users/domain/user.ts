export enum UserRoleEnum {
  systemAdmin = 'system_admin',
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
  name: string;
  email: string;
  username: string;
  profileImageUrl?: string | null;
  supabaseUserId?: string | null;
  role: UserRoleEnum;
  profileStatus: ProfileStatusEnum;
  createdAt: Date;
  updatedAt: Date;
};
