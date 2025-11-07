import { Field, ID, InputType } from "@nestjs/graphql";
import { MeetingConfirmationStatus } from "../../domain/meeting-event";

@InputType("CreateMeetingEventInput")
export class CreateMeetingEventInputType {
  @Field(() => ID, { nullable: true })
  pairingId?: string;

  @Field(() => ID)
  userAId!: string;

  @Field(() => ID)
  userBId!: string;

  @Field(() => ID)
  createdByUserId!: string;

  @Field()
  startDateTime!: Date;

  @Field()
  endDateTime!: Date;
}

@InputType("UpdateMeetingEventConfirmationInput")
export class UpdateMeetingEventConfirmationInputType {
  @Field(() => ID)
  meetingId!: string;

  @Field(() => ID)
  userId!: string;

  @Field(() => MeetingConfirmationStatus)
  status!: MeetingConfirmationStatus;

  @Field(() => Date, { nullable: true })
  proposedStartDateTime?: Date | null;

  @Field(() => Date, { nullable: true })
  proposedEndDateTime?: Date | null;

  @Field(() => String, { nullable: true })
  note?: string | null;
}

@InputType("CancelMeetingEventInput")
export class CancelMeetingEventInputType {
  @Field(() => ID)
  meetingId!: string;

  @Field(() => ID)
  cancelledByUserId!: string;

  @Field(() => String, { nullable: true })
  reason?: string | null;
}
