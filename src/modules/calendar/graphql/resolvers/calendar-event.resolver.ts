import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { User } from "src/shared/auth/decorators/user.decorator";
import type { Identity } from "src/shared/auth/domain/identity";
import { AuthenticatedUserGuard } from "src/shared/auth/guards/authenticated-user.guard";
import { CalendarEventService } from "../../services/calendar-event.service";
import { CalendarEventType } from "../types/calendar-event.type";
import {
  CreateCalendarEventInputType,
  UpdateCalendarEventInputType,
  DeleteCalendarEventInputType,
} from "../types/calendar-event-input.type";
import { ExpandedCalendarEventOccurrenceType } from "../types/expanded-occurrence.type";
import { PauseActivityInput } from "../../dto/pause-activity.input";
import {
  mapCalendarEventToGraphQL,
  mapCalendarEventsToGraphQL,
} from "../../mappers/calendar-event.mapper";
import { mapExpandedOccurrencesToGraphQL } from "../../mappers/expanded-occurrence.mapper";

@Resolver(() => CalendarEventType)
export class CalendarEventResolver {
  constructor(private calendarEventService: CalendarEventService) {}

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => CalendarEventType, { nullable: true })
  async calendarEventById(
    @User() identity: Identity,
    @Args("id", { type: () => ID }) id: string
  ): Promise<CalendarEventType | null> {
    const event = await this.calendarEventService.getCalendarEvent(
      identity,
      id
    );
    return event ? mapCalendarEventToGraphQL(event) : null;
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [CalendarEventType])
  async calendarEventsByDateRange(
    @User() identity: Identity,
    @Args("startDate") startDate: Date,
    @Args("endDate") endDate: Date
  ): Promise<CalendarEventType[]> {
    const events = await this.calendarEventService.getCalendarEventsByDateRange(
      identity,
      startDate,
      endDate
    );
    return mapCalendarEventsToGraphQL(events);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [ExpandedCalendarEventOccurrenceType])
  async expandedCalendarOccurrences(
    @User() identity: Identity,
    @Args("startDate") startDate: Date,
    @Args("endDate") endDate: Date,
    @Args("userId", { type: () => ID, nullable: true }) userId?: string
  ): Promise<ExpandedCalendarEventOccurrenceType[]> {
    // If userId is provided and differs from the requester, authorize and fetch for that user
    if (userId && userId !== identity.id) {
      const occurrences =
        await this.calendarEventService.getExpandedOccurrencesForUser(
          identity,
          userId,
          startDate,
          endDate
        );
      return mapExpandedOccurrencesToGraphQL(occurrences);
    }
    // Default: current user's occurrences
    const occurrences = await this.calendarEventService.getExpandedOccurrences(
      identity,
      startDate,
      endDate
    );
    return mapExpandedOccurrencesToGraphQL(occurrences);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => CalendarEventType)
  async createCalendarEvent(
    @User() identity: Identity,
    @Args("input") input: CreateCalendarEventInputType
  ): Promise<CalendarEventType> {
    const event = await this.calendarEventService.createCalendarEvent(
      identity,
      input as any
    );
    return mapCalendarEventToGraphQL(event);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => [CalendarEventType])
  async updateCalendarEvent(
    @User() identity: Identity,
    @Args("input") input: UpdateCalendarEventInputType,
    @Args("scope", { type: () => String, defaultValue: "this" })
    scope: "this" | "following" | "all",
    @Args("occurrenceStart", { type: () => Date, nullable: true })
    occurrenceStart?: Date
  ): Promise<CalendarEventType[]> {
    const result = await this.calendarEventService.updateCalendarEvent(
      identity,
      input.id,
      input as any,
      scope,
      occurrenceStart
    );
    // Ensure we always return an array for consistency
    const events = Array.isArray(result) ? result : [result];
    return mapCalendarEventsToGraphQL(events);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => Boolean)
  async deleteCalendarEvent(
    @User() identity: Identity,
    @Args("input") input: DeleteCalendarEventInputType
  ): Promise<boolean> {
    await this.calendarEventService.deleteCalendarEvent(
      identity,
      input.id,
      input.scope,
      input.occurrenceStart || undefined
    );
    return true;
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => CalendarEventType)
  async pauseActivity(
    @User() identity: Identity,
    @Args("input") input: PauseActivityInput
  ): Promise<CalendarEventType> {
    const event = await this.calendarEventService.pauseActivity(
      identity,
      input
    );
    return mapCalendarEventToGraphQL(event);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => Boolean)
  async resumeActivity(@User() identity: Identity): Promise<boolean> {
    return this.calendarEventService.resumeActivity(identity);
  }
}
