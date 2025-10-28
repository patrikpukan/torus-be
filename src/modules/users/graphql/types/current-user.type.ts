import { Field, ID, ObjectType } from "@nestjs/graphql";
import { ProfileStatusEnum, UserRoleEnum } from "../../domain/user";
import { OrganizationType } from "./organization.type";

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
  preferredActivity?: string | null;

  @Field(() => String, { nullable: true })
  interests?: string | null;

  @Field(() => String, { nullable: true })
  profileImageUrl?: string | null;

  @Field(() => ID)
  organizationId!: string;

  @Field(() => OrganizationType)
  organization!: OrganizationType;

  @Field(() => UserRoleEnum)
  role!: UserRoleEnum;

  @Field(() => ProfileStatusEnum)
  profileStatus!: ProfileStatusEnum;

  @Field(() => String, { nullable: true })
  username?: string | null;

  @Field(() => String, { nullable: true })
  displayUsername?: string | null;

  @Field(() => String, { nullable: true })
  supabaseUserId?: string | null;
}
