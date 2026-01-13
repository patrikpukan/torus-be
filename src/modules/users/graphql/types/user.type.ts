import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";
import { ProfileStatusEnum, UserRoleEnum } from "../../domain/user";
import { UserBanType } from "./user-ban.type";
import { DepartmentType } from "../../../organization/graphql/types/department.type";
import { TagType } from "./tag.type";

registerEnumType(UserRoleEnum, {
  name: "UserRoleEnum",
  description: "User role",
});

registerEnumType(ProfileStatusEnum, {
  name: "ProfileStatusEnum",
  description: "Profile onboarding status",
});

@ObjectType("User")
export class UserType {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  firstName?: string | null;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => String, { nullable: true })
  about?: string | null;

  @Field(() => String, { nullable: true })
  location?: string | null;

  @Field(() => String, { nullable: true })
  position?: string | null;

  @Field(() => [TagType], { nullable: true, defaultValue: [] })
  hobbies?: TagType[] | null;

  @Field(() => [TagType], { nullable: true, defaultValue: [] })
  interests?: TagType[] | null;

  @Field(() => String, { nullable: true })
  preferredActivity?: string | null;

  @Field(() => String, { nullable: true })
  profileImageUrl?: string | null;

  @Field(() => ID)
  organizationId!: string;

  @Field(() => String, { nullable: true })
  departmentId?: string | null;

  @Field(() => UserRoleEnum)
  role!: UserRoleEnum;

  @Field(() => ProfileStatusEnum)
  profileStatus!: ProfileStatusEnum;

  @Field(() => String, { nullable: true })
  supabaseUserId?: string | null;

  @Field()
  isActive!: boolean;

  @Field(() => Int)
  idealColleagueUsesRemaining!: number;

  @Field(() => GraphQLISODateTime, { nullable: true })
  suspendedUntil?: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;

  @Field(() => DepartmentType, { nullable: true })
  department?: DepartmentType | null;

  @Field(() => UserBanType, { nullable: true })
  activeBan?: UserBanType | null;
}
