import { Field, GraphQLISODateTime, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("UserReport")
export class UserReportType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  reporterId!: string;

  @Field(() => ID)
  reportedUserId!: string;

  @Field(() => ID)
  pairingId!: string;

  @Field()
  reason!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

