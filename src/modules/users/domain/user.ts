export enum UserRoleEnum {
  admin = 'admin',
  user = 'user',
}

export type User = {
  id: string;
  name: string;
  email: string;
  username: string;
  profileImageUrl?: string | null;
  role: UserRoleEnum;
  createdAt: Date;
  updatedAt: Date;
};
