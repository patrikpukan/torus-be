import { CalendarEventType } from "../graphql/types/calendar-event.type";
import {
  CalendarEvent,
  CalendarEventType as CalendarEventTypeEnum,
} from "../domain/calendar-event";

/**
 * Maps domain CalendarEvent to GraphQL CalendarEventType.
 * Ensures proper type safety without using 'as any'.
 */
export function mapCalendarEventToGraphQL(
  event: CalendarEvent
): CalendarEventType {
  return {
    id: event.id,
    userId: event.userId,
    type: event.type as CalendarEventTypeEnum,
    title: event.title,
    description: event.description,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    rrule: event.rrule,
    rruleRecurringId: event.rruleRecurringId,
    exceptionDates: event.exceptionDates,
    exceptionRrules: event.exceptionRrules,
    externalId: event.externalId,
    externalSource: event.externalSource,
    deletedAt: event.deletedAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

/**
 * Maps array of domain CalendarEvents to GraphQL types.
 */
export function mapCalendarEventsToGraphQL(
  events: CalendarEvent[]
): CalendarEventType[] {
  return events.map(mapCalendarEventToGraphQL);
}
