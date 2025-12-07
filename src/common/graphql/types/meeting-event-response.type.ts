import { Field, ObjectType } from '@nestjs/graphql';
import { MeetingEventType } from '../../../modules/calendar/graphql/types/meeting-event.type';

/**
 * Response wrapper for MeetingEvent mutations.
 * Provides consistent structure with success indicator and the resulting event.
 */
@ObjectType('MeetingEventResponse')
export class MeetingEventResponseType {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => MeetingEventType, { nullable: true })
  data?: MeetingEventType | null;
}
