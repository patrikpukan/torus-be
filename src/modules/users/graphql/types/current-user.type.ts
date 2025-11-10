import { Field, GraphQLISODateTime, ID, ObjectType } from "@nestjs/graphql";
import { ProfileStatusEnum, UserRoleEnum } from "../../domain/user";
import { SimpleOrganizationType } from "./organization.type";
import { UserBanType } from "./user-ban.type";

@ObjectType("CurrentUser")
export class CurrentUserType {
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
  hobbies?: string | null;

  @Field(() => String, { nullable: true })
  interests?: string | null;

  @Field(() => String, { nullable: true })
  preferredActivity?: string | null;

  @Field(() => String, { nullable: true })
  profileImageUrl?: string | null;

  @Field(() => ID)
  organizationId!: string;

  @Field(() => SimpleOrganizationType)
  organization!: SimpleOrganizationType;

  @Field(() => UserRoleEnum)
  role!: UserRoleEnum;

  @Field(() => ProfileStatusEnum)
  profileStatus!: ProfileStatusEnum;

  @Field(() => String, { nullable: true })
  supabaseUserId?: string | null;

  @Field()
  isActive!: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true })
  suspendedUntil?: Date | null;

  @Field(() => UserBanType, { nullable: true })
  activeBan?: UserBanType | null;
}
