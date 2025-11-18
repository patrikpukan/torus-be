import { UserType } from "../graphql/types/user.type";

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

export type UserOrganization = {
  id: string;
  name: string;
  code: string;
  imageUrl?: string | null;
};
export type CurrentUser = UserType & {
  organization: UserOrganization;
};
