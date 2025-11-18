import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("AnonUser")
export class AnonUserType {
  @Field(() => ID)
  id!: string;

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
}
