import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql";
import { CalendarEventType as CalendarEventTypeEnum } from "../../domain/calendar-event";

registerEnumType(CalendarEventTypeEnum, {
  name: "CalendarEventType",
  description: "Type of calendar event: availability or unavailability",
});

@ObjectType("CalendarEvent")
export class CalendarEventType {
  @Field(() => ID)
  id!: string;

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

  @Field(() => String, { nullable: true })
  rruleRecurringId?: string | null;

  @Field(() => String, { nullable: true })
  exceptionDates?: string | null;

  @Field(() => String, { nullable: true })
  exceptionRrules?: string | null;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
