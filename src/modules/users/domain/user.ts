import { Quack } from '../../quack/domain/quack';

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
  quacks?: Quack[];
  createdAt: Date;
  updatedAt: Date;
};
