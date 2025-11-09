import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql";
import { MeetingConfirmationStatus } from "../../domain/meeting-event";

registerEnumType(MeetingConfirmationStatus, {
  name: "MeetingConfirmationStatus",
  description:
    "Meeting confirmation status: pending, confirmed, rejected, or proposed",
});

@ObjectType("MeetingEvent")
export class MeetingEventType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { nullable: true })
  pairingId?: string | null;

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

  @Field(() => MeetingConfirmationStatus)
  userAConfirmationStatus!: MeetingConfirmationStatus;

  @Field(() => MeetingConfirmationStatus)
  userBConfirmationStatus!: MeetingConfirmationStatus;

  @Field(() => Date, { nullable: true })
  userAProposedStartDateTime?: Date | null;

  @Field(() => Date, { nullable: true })
  userAProposedEndDateTime?: Date | null;

  @Field(() => Date, { nullable: true })
  userBProposedStartDateTime?: Date | null;

  @Field(() => Date, { nullable: true })
  userBProposedEndDateTime?: Date | null;

  @Field(() => String, { nullable: true })
  userANote?: string | null;

  @Field(() => String, { nullable: true })
  userBNote?: string | null;

  @Field(() => Date, { nullable: true })
  cancelledAt?: Date | null;

  @Field(() => ID, { nullable: true })
  cancelledByUserId?: string | null;

  @Field(() => String, { nullable: true })
  cancellationReason?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
