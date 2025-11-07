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

@Resolver(() => CalendarEventType)
export class CalendarEventResolver {
  constructor(private calendarEventService: CalendarEventService) {}

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => CalendarEventType, { nullable: true })
  async calendarEventById(
    @User() identity: Identity,
    @Args("id", { type: () => ID }) id: string
  ): Promise<CalendarEventType | null> {
    return this.calendarEventService.getCalendarEvent(identity, id) as any;
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [CalendarEventType])
  async calendarEventsByDateRange(
    @User() identity: Identity,
    @Args("startDate") startDate: Date,
    @Args("endDate") endDate: Date
  ): Promise<CalendarEventType[]> {
    return this.calendarEventService.getCalendarEventsByDateRange(
      identity,
      startDate,
      endDate
    ) as any;
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [ExpandedCalendarEventOccurrenceType])
  async expandedCalendarOccurrences(
    @User() identity: Identity,
    @Args("startDate") startDate: Date,
    @Args("endDate") endDate: Date
  ): Promise<ExpandedCalendarEventOccurrenceType[]> {
    return this.calendarEventService.getExpandedOccurrences(
      identity,
      startDate,
      endDate
    ) as any;
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => CalendarEventType)
  async createCalendarEvent(
    @User() identity: Identity,
    @Args("input") input: CreateCalendarEventInputType
  ): Promise<CalendarEventType> {
    return this.calendarEventService.createCalendarEvent(
      identity,
      input as any
    ) as any;
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => CalendarEventType)
  async updateCalendarEvent(
    @User() identity: Identity,
    @Args("input") input: UpdateCalendarEventInputType,
    @Args("scope", { type: () => String, defaultValue: "this" })
    scope: "this" | "following" | "all"
  ): Promise<CalendarEventType | CalendarEventType[]> {
    return this.calendarEventService.updateCalendarEvent(
      identity,
      input.id,
      input as any,
      scope
    ) as any;
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
      input.scope
    );
    return true;
  }
}
