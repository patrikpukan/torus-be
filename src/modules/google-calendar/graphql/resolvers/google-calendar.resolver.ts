import { UseGuards } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { User } from "src/shared/auth/decorators/user.decorator";
import type { Identity } from "src/shared/auth/domain/identity";
import { AuthenticatedUserGuard } from "src/shared/auth/guards/authenticated-user.guard";
import { GoogleCalendarService } from "../../services/google-calendar.service";
import {
  GoogleCalendar,
  GoogleCalendarImportResult,
  ImportGoogleCalendarEventsInput,
} from "../types/google-calendar.types";

@Resolver()
export class GoogleCalendarResolver {
  constructor(private googleCalendarService: GoogleCalendarService) {}

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [GoogleCalendar])
  async googleCalendarList(
    @User() identity: Identity,
    @Args("accessToken", { nullable: true }) accessToken?: string
  ): Promise<GoogleCalendar[]> {
    return this.googleCalendarService.getCalendarList(identity, accessToken);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => GoogleCalendarImportResult)
  async importGoogleCalendarEvents(
    @User() identity: Identity,
    @Args("input") input: ImportGoogleCalendarEventsInput
  ): Promise<GoogleCalendarImportResult> {
    return this.googleCalendarService.importEvents(identity, {
      calendarIds: input.calendarIds,
      startDate: input.startDate,
      endDate: input.endDate,
      accessToken: input.accessToken,
    });
  }
}
