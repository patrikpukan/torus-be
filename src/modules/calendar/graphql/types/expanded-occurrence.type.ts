import { Field, ID, ObjectType } from "@nestjs/graphql";
import { CalendarEventType } from "./calendar-event.type";

@ObjectType("ExpandedCalendarEventOccurrence")
export class ExpandedCalendarEventOccurrenceType {
  @Field(() => ID)
  id!: string;

  @Field()
  occurrenceStart!: Date;

  @Field()
  occurrenceEnd!: Date;

  @Field(() => CalendarEventType)
  originalEvent!: CalendarEventType;
}
