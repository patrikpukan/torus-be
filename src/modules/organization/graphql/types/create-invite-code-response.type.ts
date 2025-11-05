import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class CreateInviteCodeResponseType {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field()
  code: string;

  @Field()
  inviteUrl: string;

  @Field({ nullable: true })
  expiresAt?: Date;
}
