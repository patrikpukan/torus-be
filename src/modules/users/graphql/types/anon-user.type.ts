import { Field, ID, ObjectType } from "@nestjs/graphql";
import { TagType } from "./tag.type";
import { UserRoleEnum } from "../../domain/user";

@ObjectType("AnonUser")
export class AnonUserType {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  firstName?: string | null;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => [TagType], { nullable: true })
  hobbies?: TagType[] | null;

  @Field(() => [TagType], { nullable: true })
  interests?: TagType[] | null;

  @Field(() => String, { nullable: true })
  preferredActivity?: string | null;

  @Field(() => String, { nullable: true })
  profileImageUrl?: string | null;

  @Field(() => UserRoleEnum, { nullable: true })
  role?: UserRoleEnum | null;

  @Field(() => ID)
  organizationId!: string;
}
