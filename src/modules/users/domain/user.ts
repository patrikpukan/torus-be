import { Quack } from '../../quack/domain/quack';

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
  quacks?: Quack[];
  createdAt: Date;
  updatedAt: Date;
};
