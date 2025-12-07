import { ExpandedCalendarEventOccurrenceType } from "../graphql/types/expanded-occurrence.type";
import { CalendarEvent } from "../domain/calendar-event";
import { mapCalendarEventToGraphQL } from "./calendar-event.mapper";

/**
 * Represents an expanded calendar occurrence with the original event data.
 */
export type ExpandedOccurrence = {
  id: string;
  occurrenceStart: Date;
  occurrenceEnd: Date;
  originalEvent: CalendarEvent;
};

/**
 * Maps domain ExpandedOccurrence to GraphQL ExpandedCalendarEventOccurrenceType.
 * Ensures proper type safety without using 'as any'.
 */
export function mapExpandedOccurrenceToGraphQL(
  occurrence: ExpandedOccurrence
): ExpandedCalendarEventOccurrenceType {
  return {
    id: occurrence.id,
    occurrenceStart: occurrence.occurrenceStart,
    occurrenceEnd: occurrence.occurrenceEnd,
    originalEvent: mapCalendarEventToGraphQL(occurrence.originalEvent),
  };
}

/**
 * Maps array of domain ExpandedOccurrences to GraphQL types.
 */
export function mapExpandedOccurrencesToGraphQL(
  occurrences: ExpandedOccurrence[]
): ExpandedCalendarEventOccurrenceType[] {
  return occurrences.map(mapExpandedOccurrenceToGraphQL);
}
