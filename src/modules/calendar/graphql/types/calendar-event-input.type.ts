import { Field, ID, InputType } from "@nestjs/graphql";
import { CalendarEventType as CalendarEventTypeEnum } from "../../domain/calendar-event";

@InputType("CreateCalendarEventInput")
export class CreateCalendarEventInputType {
  @Field(() => ID)
  userId!: string;

  @Field(() => CalendarEventTypeEnum)
  type!: CalendarEventTypeEnum;

  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field()
  startDateTime!: Date;

  @Field()
  endDateTime!: Date;

  @Field(() => String, { nullable: true })
  rrule?: string | null;
}

@InputType("UpdateCalendarEventInput")
export class UpdateCalendarEventInputType {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => CalendarEventTypeEnum, { nullable: true })
  type?: CalendarEventTypeEnum;

  @Field(() => Date, { nullable: true })
  startDateTime?: Date;

  @Field(() => Date, { nullable: true })
  endDateTime?: Date;
}

@InputType("DeleteCalendarEventInput")
export class DeleteCalendarEventInputType {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { defaultValue: "this" })
  scope!: "this" | "following" | "all";

  // Optional: specific occurrence start date to target a single occurrence
  @Field(() => Date, { nullable: true })
  occurrenceStart?: Date | null;
}
