import { Field, InputType } from "@nestjs/graphql";
import { IsOptional, IsUUID } from "class-validator";

@InputType()
export class UpdateCurrentUserProfileInputType {
  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  about?: string;

  @Field(() => String, { nullable: true })
  hobbies?: string;

  @Field(() => String, { nullable: true })
  preferredActivity?: string;

  @Field(() => String, { nullable: true })
  interests?: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

}
