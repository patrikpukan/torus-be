import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { User } from "src/shared/auth/decorators/user.decorator";
import type { Identity } from "src/shared/auth/domain/identity";
import { AuthenticatedUserGuard } from "src/shared/auth/guards/authenticated-user.guard";
import { MeetingEventService } from "../../services/meeting-event.service";
import { MeetingEventType } from "../types/meeting-event.type";
import {
  CreateMeetingEventInputType,
  UpdateMeetingEventConfirmationInputType,
  CancelMeetingEventInputType,
} from "../types/meeting-event-input.type";
import {
  mapMeetingEventToGraphQL,
  mapMeetingEventsToGraphQL,
} from "../../mappers/meeting-event.mapper";

@Resolver(() => MeetingEventType)
export class MeetingEventResolver {
  constructor(private meetingEventService: MeetingEventService) {}

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => MeetingEventType, { nullable: true })
  async meetingEventById(
    @User() identity: Identity,
    @Args("id", { type: () => ID }) id: string
  ): Promise<MeetingEventType | null> {
    const event = await this.meetingEventService.getMeetingEvent(identity, id);
    return event ? mapMeetingEventToGraphQL(event) : null;
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [MeetingEventType])
  async meetingEventsByDateRange(
    @User() identity: Identity,
    @Args("startDate") startDate: Date,
    @Args("endDate") endDate: Date
  ): Promise<MeetingEventType[]> {
    const events = await this.meetingEventService.getMeetingsByDateRange(
      identity,
      startDate,
      endDate
    );
    return mapMeetingEventsToGraphQL(events);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [MeetingEventType])
  async upcomingMeetings(
    @User() identity: Identity
  ): Promise<MeetingEventType[]> {
    const events = await this.meetingEventService.getUpcomingMeetings(identity);
    return mapMeetingEventsToGraphQL(events);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [MeetingEventType])
  async pendingMeetingConfirmations(
    @User() identity: Identity
  ): Promise<MeetingEventType[]> {
    const events =
      await this.meetingEventService.getPendingConfirmations(identity);
    return mapMeetingEventsToGraphQL(events);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => MeetingEventType, { nullable: true })
  async latestMeetingForPairing(
    @User() identity: Identity,
    @Args("pairingId", { type: () => ID }) pairingId: string
  ): Promise<MeetingEventType | null> {
    const event = await this.meetingEventService.getLatestMeetingForPairing(
      identity,
      pairingId
    );
    return event ? mapMeetingEventToGraphQL(event) : null;
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [MeetingEventType])
  async allMeetingsForPairing(
    @User() identity: Identity,
    @Args("pairingId", { type: () => ID }) pairingId: string
  ): Promise<MeetingEventType[]> {
    const events = await this.meetingEventService.getAllMeetingsForPairing(
      identity,
      pairingId
    );
    return mapMeetingEventsToGraphQL(events);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => MeetingEventType)
  async createMeetingEvent(
    @User() identity: Identity,
    @Args("input") input: CreateMeetingEventInputType
  ): Promise<MeetingEventType> {
    const event = await this.meetingEventService.createMeetingEvent(
      identity,
      input as any
    );
    return mapMeetingEventToGraphQL(event);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => MeetingEventType)
  async confirmMeeting(
    @User() identity: Identity,
    @Args("meetingId", { type: () => ID }) meetingId: string,
    @Args("note", { nullable: true }) note?: string
  ): Promise<MeetingEventType> {
    const event = await this.meetingEventService.confirmMeeting(
      identity,
      meetingId,
      note
    );
    return mapMeetingEventToGraphQL(event);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => MeetingEventType)
  async rejectMeeting(
    @User() identity: Identity,
    @Args("meetingId", { type: () => ID }) meetingId: string,
    @Args("note", { nullable: true }) note?: string
  ): Promise<MeetingEventType> {
    const event = await this.meetingEventService.rejectMeeting(
      identity,
      meetingId,
      note
    );
    return mapMeetingEventToGraphQL(event);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => MeetingEventType)
  async proposeMeetingTime(
    @User() identity: Identity,
    @Args("input") input: UpdateMeetingEventConfirmationInputType
  ): Promise<MeetingEventType> {
    const event = await this.meetingEventService.proposeMeetingTime(
      identity,
      input as any
    );
    return mapMeetingEventToGraphQL(event);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => MeetingEventType)
  async updateMeetingToProposedTime(
    @User() identity: Identity,
    @Args("meetingId", { type: () => ID }) meetingId: string
  ): Promise<MeetingEventType> {
    const event = await this.meetingEventService.updateMeetingToProposedTime(
      identity,
      meetingId
    );
    return mapMeetingEventToGraphQL(event);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => MeetingEventType)
  async cancelMeeting(
    @User() identity: Identity,
    @Args("input") input: CancelMeetingEventInputType
  ): Promise<MeetingEventType> {
    const event = await this.meetingEventService.cancelMeeting(
      identity,
      input as any
    );
    return mapMeetingEventToGraphQL(event);
  }
}
