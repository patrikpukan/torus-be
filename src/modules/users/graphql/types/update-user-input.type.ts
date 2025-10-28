import { Field, ID, InputType } from "@nestjs/graphql";
import { UserRoleEnum } from "../../domain/user";

@InputType()
export class UpdateUserInputType {
  @Field(() => ID)
  id!: string;

  @Field(() => UserRoleEnum, { nullable: true })
  role?: UserRoleEnum;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  username?: string;

  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  profileImageUrl?: string;

  @Field(() => String, { nullable: true })
  about?: string;

  @Field(() => String, { nullable: true })
  hobbies?: string;

  @Field(() => String, { nullable: true })
  preferredActivity?: string;

  @Field(() => String, { nullable: true })
  interests?: string;
}
