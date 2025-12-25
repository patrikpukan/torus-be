import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class UserSummary {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;
}

@ObjectType()
export class UnratedMeetingType {
  @Field(() => ID)
  id: string;

  @Field()
  startDateTime: Date;

  @Field()
  endDateTime: Date;

  @Field(() => ID)
  userAId: string;

  @Field(() => ID)
  userBId: string;

  @Field(() => UserSummary)
  userA: UserSummary;

  @Field(() => UserSummary)
  userB: UserSummary;
}
