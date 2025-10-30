import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class InviteUserResponseType {
  @Field()
  success!: boolean;

  @Field()
  message!: string;

  @Field(() => String, { nullable: true })
  userId?: string;
}
