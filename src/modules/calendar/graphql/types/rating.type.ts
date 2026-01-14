import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { MeetingEventType } from "./meeting-event.type";

@ObjectType()
class RatingUserType {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  firstName?: string | null;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => String, { nullable: true })
  profileImageUrl?: string | null;
}

@ObjectType()
export class RatingType {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  meetingEventId: string;

  @Field(() => MeetingEventType)
  meetingEvent: MeetingEventType;

  @Field(() => ID)
  userId: string;

  @Field(() => RatingUserType, { nullable: true })
  user?: RatingUserType;

  @Field(() => Int)
  stars: number;

  @Field({ nullable: true })
  feedback?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
