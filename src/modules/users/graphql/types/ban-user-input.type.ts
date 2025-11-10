import { Field, GraphQLISODateTime, ID, InputType } from "@nestjs/graphql";

@InputType("BanUserInput")
export class BanUserInputType {
  @Field(() => ID)
  userId!: string;

  @Field()
  reason!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  expiresAt?: Date | null;
}
