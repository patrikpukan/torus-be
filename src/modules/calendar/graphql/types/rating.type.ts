import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { MeetingEventType } from "./meeting-event.type";

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

  @Field(() => Int)
  stars: number;

  @Field({ nullable: true })
  feedback?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
