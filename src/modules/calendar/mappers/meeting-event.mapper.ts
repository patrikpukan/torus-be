import { MeetingEventType } from "../graphql/types/meeting-event.type";
import {
  MeetingEvent,
  MeetingConfirmationStatus,
} from "../domain/meeting-event";

/**
 * Maps domain MeetingEvent to GraphQL MeetingEventType.
 * Ensures proper type safety without using 'as any'.
 */
export function mapMeetingEventToGraphQL(
  event: MeetingEvent
): MeetingEventType {
  return {
    id: event.id,
    pairingId: event.pairingId,
    userAId: event.userAId,
    userBId: event.userBId,
    createdByUserId: event.createdByUserId,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    userAConfirmationStatus: event.userAConfirmationStatus as MeetingConfirmationStatus,
    userBConfirmationStatus: event.userBConfirmationStatus as MeetingConfirmationStatus,
    userAProposedStartDateTime: event.userAProposedStartDateTime,
    userAProposedEndDateTime: event.userAProposedEndDateTime,
    userBProposedStartDateTime: event.userBProposedStartDateTime,
    userBProposedEndDateTime: event.userBProposedEndDateTime,
    userANote: event.userANote,
    userBNote: event.userBNote,
    cancelledAt: event.cancelledAt,
    cancelledByUserId: event.cancelledByUserId,
    cancellationReason: event.cancellationReason,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

/**
 * Maps array of domain MeetingEvents to GraphQL types.
 */
export function mapMeetingEventsToGraphQL(
  events: MeetingEvent[]
): MeetingEventType[] {
  return events.map(mapMeetingEventToGraphQL);
}
