import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, CalendarEventType } from "@prisma/client";
import { RRuleSet, rrulestr } from "rrule";
import { PrismaService } from "src/core/prisma/prisma.service";
import { withRls } from "src/db/withRls";
import { getRlsClaims } from "src/shared/auth/utils/get-rls-claims";
import { Identity } from "src/shared/auth/domain/identity";
import { CalendarEventRepository } from "../repositories/calendar-event.repository";
import {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "../domain/calendar-event";
import {
  PauseActivityInput,
  PauseDurationType,
} from "../dto/pause-activity.input";
import { PairingAlgorithmService } from "../../pairing-algorithm/pairing-algorithm.service";

@Injectable()
export class CalendarEventService {
  private readonly logger = new Logger(CalendarEventService.name);

  constructor(
    private readonly calendarEventRepository: CalendarEventRepository,
    private readonly prisma: PrismaService,
    private readonly pairingAlgorithmService: PairingAlgorithmService
  ) {}

  async createCalendarEvent(
    identity: Identity,
    input: CreateCalendarEventInput
  ): Promise<CalendarEvent> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      // Validate user owns this calendar
      if (input.userId !== identity.id) {
        throw new BadRequestException(
          "Cannot create calendar event for another user"
        );
      }

      // Validate date range
      if (input.startDateTime >= input.endDateTime) {
        throw new BadRequestException(
          "startDateTime must be before endDateTime"
        );
      }

      // Generate recurring ID if RRULE is provided
      let rruleRecurringId: string | null = null;
      if (input.rrule) {
        try {
          // Validate RRULE is valid RFC 5545
          rrulestr(input.rrule, {
            dtstart: input.startDateTime,
          });
          // Generate a unique ID for this recurring series
          rruleRecurringId = this.generateRecurringId();
        } catch (error) {
          throw new BadRequestException(
            `Invalid RRULE format: ${error instanceof Error ? error.message : "unknown error"}`
          );
        }
      }

      return this.calendarEventRepository.create(
        {
          user: { connect: { id: input.userId } },
          type: input.type as any,
          title: input.title,
          description: input.description,
          startDateTime: input.startDateTime,
          endDateTime: input.endDateTime,
          rrule: input.rrule,
          rruleRecurringId,
        } as any,
        tx
      );
    });
  }

  async getCalendarEvent(
    identity: Identity,
    id: string
  ): Promise<CalendarEvent | null> {
    return withRls(this.prisma, getRlsClaims(identity), (tx) =>
      this.calendarEventRepository.findById(id, tx)
    );
  }

  async getCalendarEventsByDateRange(
    identity: Identity,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      if (startDate >= endDate) {
        throw new BadRequestException("startDate must be before endDate");
      }

      return this.calendarEventRepository.findByUserIdAndDateRange(
        identity.id,
        startDate,
        endDate,
        tx
      );
    });
  }

  /**
   * Get expanded occurrences of recurring events for a date range
   * Handles RRULE expansion with exception dates
   */
  async getExpandedOccurrences(
    identity: Identity,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      id: string;
      occurrenceStart: Date;
      occurrenceEnd: Date;
      originalEvent: CalendarEvent;
    }>
  > {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const events =
        await this.calendarEventRepository.findByUserIdAndDateRange(
          identity.id,
          startDate,
          endDate,
          tx
        );

      const occurrences: Array<{
        id: string;
        occurrenceStart: Date;
        occurrenceEnd: Date;
        originalEvent: CalendarEvent;
      }> = [];

      for (const event of events) {
        if (!event.rrule) {
          // Single occurrence
          occurrences.push({
            id: event.id,
            occurrenceStart: event.startDateTime,
            occurrenceEnd: event.endDateTime,
            originalEvent: event,
          });
        } else {
          // Expand recurring event
          const expandedOccurrences = this.expandRecurringEvent(
            event,
            startDate,
            endDate
          );
          occurrences.push(...expandedOccurrences);
        }
      }

      return occurrences.sort(
        (a, b) => a.occurrenceStart.getTime() - b.occurrenceStart.getTime()
      );
    });
  }

  /**
   * Get expanded occurrences for a specific user's calendar, with authorization.
   * Allowed when requesting own calendar or when requester is paired with the target user.
   */
  async getExpandedOccurrencesForUser(
    identity: Identity,
    targetUserId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      id: string;
      occurrenceStart: Date;
      occurrenceEnd: Date;
      originalEvent: CalendarEvent;
    }>
  > {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      if (startDate >= endDate) {
        throw new BadRequestException("startDate must be before endDate");
      }

      // If requesting someone else's calendar, ensure users are paired
      if (identity.id !== targetUserId) {
        const pairing = await tx.pairing.findFirst({
          where: {
            OR: [
              { userAId: identity.id, userBId: targetUserId },
              { userAId: targetUserId, userBId: identity.id },
            ],
          },
        });

        if (!pairing) {
          throw new BadRequestException(
            "Cannot view calendar for a user you are not paired with"
          );
        }
      }

      const events =
        await this.calendarEventRepository.findByUserIdAndDateRange(
          targetUserId,
          startDate,
          endDate,
          tx
        );

      const occurrences: Array<{
        id: string;
        occurrenceStart: Date;
        occurrenceEnd: Date;
        originalEvent: CalendarEvent;
      }> = [];

      for (const event of events) {
        if (!event.rrule) {
          occurrences.push({
            id: event.id,
            occurrenceStart: event.startDateTime,
            occurrenceEnd: event.endDateTime,
            originalEvent: event,
          });
        } else {
          const expandedOccurrences = this.expandRecurringEvent(
            event,
            startDate,
            endDate
          );
          occurrences.push(...expandedOccurrences);
        }
      }

      return occurrences.sort(
        (a, b) => a.occurrenceStart.getTime() - b.occurrenceStart.getTime()
      );
    });
  }

  /**
   * Expand a recurring event (RRULE) into individual occurrences
   */
  private expandRecurringEvent(
    event: CalendarEvent,
    startDate: Date,
    endDate: Date
  ): Array<{
    id: string;
    occurrenceStart: Date;
    occurrenceEnd: Date;
    originalEvent: CalendarEvent;
  }> {
    const occurrences: Array<{
      id: string;
      occurrenceStart: Date;
      occurrenceEnd: Date;
      originalEvent: CalendarEvent;
    }> = [];

    try {
      if (!event.rrule) {
        return occurrences;
      }

      // Parse RRULE
      const rruleSet = new RRuleSet();
      rruleSet.rrule(
        rrulestr(event.rrule, {
          dtstart: event.startDateTime,
        })
      );

      // Add exception dates
      if (event.exceptionDates) {
        try {
          const exceptionDates = JSON.parse(event.exceptionDates) as string[];
          for (const dateStr of exceptionDates) {
            rruleSet.exdate(new Date(dateStr));
          }
        } catch (error) {
          this.logger.warn(
            `Failed to parse exception dates for event ${event.id}`,
            error
          );
        }
      }

      // Add exception RRULEs
      if (event.exceptionRrules) {
        try {
          const exceptionRrules = JSON.parse(event.exceptionRrules) as string[];
          for (const ruleStr of exceptionRrules) {
            rruleSet.exrule(
              rrulestr(ruleStr, {
                dtstart: event.startDateTime,
              })
            );
          }
        } catch (error) {
          this.logger.warn(
            `Failed to parse exception RRULEs for event ${event.id}`,
            error
          );
        }
      }

      // Get occurrences between startDate and endDate
      const eventDuration =
        event.endDateTime.getTime() - event.startDateTime.getTime();
      const dates = rruleSet.between(startDate, endDate, true);

      for (const date of dates) {
        // Generate a unique ID for each occurrence using event ID and occurrence start time
        // This ensures each recurring event instance gets a unique identifier
        const occurrenceId = `${event.id}_${date.toISOString().replace(/[^\w]/g, "")}`;
        occurrences.push({
          id: occurrenceId,
          occurrenceStart: date,
          occurrenceEnd: new Date(date.getTime() + eventDuration),
          originalEvent: event,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to expand recurring event ${event.id}: ${error instanceof Error ? error.message : "unknown error"}`
      );
    }

    return occurrences;
  }

  async updateCalendarEvent(
    identity: Identity,
    id: string,
    input: UpdateCalendarEventInput,
    scope: "this" | "following" | "all" = "this",
    occurrenceStart?: Date
  ): Promise<CalendarEvent | CalendarEvent[]> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const event = await this.calendarEventRepository.findById(id, tx);

      if (!event) {
        throw new NotFoundException("Calendar event not found");
      }

      if (event.userId !== identity.id) {
        throw new BadRequestException(
          "Cannot update calendar event of another user"
        );
      }

      // Validate dates if provided
      if (
        input.startDateTime &&
        input.endDateTime &&
        input.startDateTime >= input.endDateTime
      ) {
        throw new BadRequestException(
          "startDateTime must be before endDateTime"
        );
      }

      // If not a recurring event, only "this" scope is valid
      if (!event.rrule) {
        return this.calendarEventRepository.update(
          id,
          {
            ...(input.type !== undefined && { type: input.type as any }),
            ...(input.title !== undefined && { title: input.title }),
            ...(input.description !== undefined && {
              description: input.description,
            }),
          },
          tx
        );
      }

      // Handle recurring event updates with scope
      switch (scope) {
        case "this":
          return this.updateThisOccurrence(
            event,
            id,
            input,
            tx,
            occurrenceStart
          );
        case "following":
          return this.updateFollowingOccurrences(
            event,
            id,
            input,
            tx,
            occurrenceStart
          );
        case "all":
          return this.updateAllOccurrences(event, id, input, tx);
        default:
          throw new BadRequestException("Invalid scope");
      }
    });
  }

  /**
   * Update only this occurrence by adding exception date
   */
  private async updateThisOccurrence(
    event: CalendarEvent,
    id: string,
    input: UpdateCalendarEventInput,
    tx: Prisma.TransactionClient,
    occurrenceStart?: Date
  ): Promise<CalendarEvent> {
    // Create a new event with the updated details and same rruleRecurringId
    // Use input.startDateTime/input.endDateTime if provided (editing the occurrence),
    // otherwise fall back to the occurrenceStart passed or the original event start
    const newStart = input.startDateTime
      ? input.startDateTime
      : occurrenceStart
        ? occurrenceStart
        : event.startDateTime;
    const newEnd = input.endDateTime ? input.endDateTime : event.endDateTime;

    // Create the single exception event
    const created = await this.calendarEventRepository.create(
      {
        user: { connect: { id: event.userId } },
        type: (input.type || event.type) as any,
        title: input.title !== undefined ? input.title : event.title,
        description:
          input.description !== undefined
            ? input.description
            : event.description,
        startDateTime: newStart,
        endDateTime: newEnd,
        rrule: null, // This is now a single occurrence
        rruleRecurringId: event.rruleRecurringId, // Keep same series ID for reference
      } as any,
      tx
    );

    // Also add an exception date to the original series so the original occurrence is hidden
    const exceptionDates = event.exceptionDates
      ? JSON.parse(event.exceptionDates)
      : [];
    const dateToAdd = occurrenceStart
      ? occurrenceStart.toISOString()
      : event.startDateTime.toISOString();
    exceptionDates.push(dateToAdd);

    await this.calendarEventRepository.update(
      event.id,
      {
        exceptionDates: JSON.stringify(exceptionDates),
      },
      tx
    );

    return created;
  }

  /**
   * Update following occurrences by modifying RRULE until date
   */
  private async updateFollowingOccurrences(
    event: CalendarEvent,
    id: string,
    input: UpdateCalendarEventInput,
    tx: Prisma.TransactionClient,
    occurrenceStart?: Date
  ): Promise<CalendarEvent[]> {
    if (!event.rrule) {
      throw new BadRequestException(
        "Cannot update following occurrences for non-recurring event"
      );
    }
    // Modify original event's RRULE to end before this occurrence (use occurrenceStart if provided)
    const splitDate = occurrenceStart || event.startDateTime;
    // Use one second before the splitDate to avoid day rounding/UTC issues
    const originalUntilDate = new Date(splitDate.getTime() - 1000);

    const updatedOriginal = await this.calendarEventRepository.update(
      id,
      {
        rrule: this.addUntilToRrule(event.rrule, originalUntilDate),
      },
      tx
    );

    // Create new recurring event for updated portion starting at either input.startDateTime or the split date
    const newStart = input.startDateTime ? input.startDateTime : splitDate;
    const newEnd = input.endDateTime ? input.endDateTime : event.endDateTime;

    const newEvent = await this.calendarEventRepository.create(
      {
        user: { connect: { id: event.userId } },
        type: (input.type || event.type) as any,
        title: input.title !== undefined ? input.title : event.title,
        description:
          input.description !== undefined
            ? input.description
            : event.description,
        startDateTime: newStart,
        endDateTime: newEnd,
        rrule: this.removeUntilFromRrule(event.rrule),
        rruleRecurringId: event.rruleRecurringId,
      } as any,
      tx
    );

    return [updatedOriginal, newEvent];
  }

  /**
   * Update all occurrences by updating original recurring event
   * Only updates title, description, and type - NOT startDateTime/endDateTime
   * (changing the base event's start time would break the recurrence pattern)
   */
  private async updateAllOccurrences(
    event: CalendarEvent,
    id: string,
    input: UpdateCalendarEventInput,
    tx: Prisma.TransactionClient
  ): Promise<CalendarEvent> {
    if (!event.rrule) {
      throw new BadRequestException(
        "Cannot update all occurrences for non-recurring event"
      );
    }

    return this.calendarEventRepository.update(
      id,
      {
        ...(input.type !== undefined && { type: input.type as any }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        // Note: We intentionally do NOT update startDateTime/endDateTime for recurring events
        // Changing the base event's start time would break the RRULE expansion
      },
      tx
    );
  }

  async deleteCalendarEvent(
    identity: Identity,
    id: string,
    scope: "this" | "following" | "all" = "this",
    occurrenceStart?: Date
  ): Promise<void> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const event = await this.calendarEventRepository.findById(id, tx);

      if (!event) {
        throw new NotFoundException("Calendar event not found");
      }

      if (event.userId !== identity.id) {
        throw new BadRequestException(
          "Cannot delete calendar event of another user"
        );
      }

      if (!event.rrule) {
        // Single occurrence - just soft delete
        await this.calendarEventRepository.softDelete(id, tx);
        return;
      }

      // Handle recurring event deletion with scope
      switch (scope) {
        case "this":
          await this.deleteThisOccurrence(event, id, tx, occurrenceStart);
          break;
        case "following":
          await this.deleteFollowingOccurrences(event, id, tx, occurrenceStart);
          break;
        case "all":
          await this.deleteAllOccurrences(event, tx);
          break;
        default:
          throw new BadRequestException("Invalid scope");
      }
    });
  }

  /**
   * Delete only this occurrence by adding exception date
   */
  private async deleteThisOccurrence(
    event: CalendarEvent,
    id: string,
    tx: Prisma.TransactionClient,
    occurrenceStart?: Date
  ): Promise<void> {
    const exceptionDates = event.exceptionDates
      ? JSON.parse(event.exceptionDates)
      : [];
    const dateToAdd = occurrenceStart
      ? occurrenceStart.toISOString()
      : event.startDateTime.toISOString();
    exceptionDates.push(dateToAdd);

    await this.calendarEventRepository.update(
      id,
      {
        exceptionDates: JSON.stringify(exceptionDates),
      },
      tx
    );
  }

  /**
   * Delete following occurrences by modifying RRULE until date
   */
  private async deleteFollowingOccurrences(
    event: CalendarEvent,
    id: string,
    tx: Prisma.TransactionClient,
    occurrenceStart?: Date
  ): Promise<void> {
    const baseDate = occurrenceStart || event.startDateTime;
    // Use one second before the base date to avoid day rounding/UTC issues
    const untilDate = new Date(baseDate.getTime() - 1000);

    await this.calendarEventRepository.update(
      id,
      {
        rrule: this.addUntilToRrule(event.rrule || "", untilDate),
      },
      tx
    );
  }

  /**
   * Delete all occurrences by soft deleting
   */
  private async deleteAllOccurrences(
    event: CalendarEvent,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    // Delete entire series
    const series = await this.calendarEventRepository.findRecurringSeries(
      event.rruleRecurringId || "",
      tx
    );

    for (const seriesEvent of series) {
      await this.calendarEventRepository.softDelete(seriesEvent.id, tx);
    }
  }

  /**
   * Helper: Add UNTIL clause to RRULE
   */
  private addUntilToRrule(rrule: string, untilDate: Date): string {
    // Remove existing UNTIL if present
    let modifiedRrule = rrule.replace(/;UNTIL=[^;]+/, "");
    // Format UNTIL as full UTC timestamp in YYYYMMDDTHHMMSSZ
    const iso =
      untilDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    return `${modifiedRrule};UNTIL=${iso}`;
  }

  /**
   * Helper: Remove UNTIL clause from RRULE
   */
  private removeUntilFromRrule(rrule: string): string {
    return rrule.replace(/;UNTIL=[^;]+/, "");
  }

  /**
   * Generate unique ID for recurring series
   */
  private generateRecurringId(): string {
    return `recurring-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Pauses user activity by creating an unavailability event.
   * Duration can be for a specific number of periods, until a date, or indefinite.
   *
   * @param identity - Current user identity
   * @param input - Pause activity input with duration type and parameters
   * @returns Created calendar event representing the pause
   */
  async pauseActivity(
    identity: Identity,
    input: PauseActivityInput
  ): Promise<CalendarEvent> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const userId = identity.id;

      // Get user's organization
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      });

      if (!user?.organizationId) {
        throw new Error("User organization not found");
      }

      // Calculate start time (next period start)
      const startTime = await this.pairingAlgorithmService.getNextPeriodStart(
        user.organizationId
      );

      // Calculate end time based on duration type
      let endTime: Date;
      let description: string;

      switch (input.durationType) {
        case PauseDurationType.ONE_PERIOD:
          endTime = await this.pairingAlgorithmService.calculatePeriodEnd(
            user.organizationId,
            startTime,
            1
          );
          description = "Paused for 1 period";
          break;

        case PauseDurationType.N_PERIODS:
          if (!input.periodsCount || input.periodsCount < 1) {
            throw new Error("periodsCount must be at least 1");
          }
          endTime = await this.pairingAlgorithmService.calculatePeriodEnd(
            user.organizationId,
            startTime,
            input.periodsCount
          );
          description = `Paused for ${input.periodsCount} periods`;
          break;

        case PauseDurationType.UNTIL_DATE:
          if (!input.untilDate) {
            throw new Error(
              "untilDate is required for UNTIL_DATE duration type"
            );
          }
          endTime = new Date(input.untilDate);
          description = `Paused until ${endTime.toLocaleDateString("en-US")}`;
          break;

        case PauseDurationType.INDEFINITE:
          endTime = new Date();
          endTime.setFullYear(endTime.getFullYear() + 100);
          description = "Paused indefinitely";
          break;

        default:
          throw new Error("Invalid duration type");
      }

      // Create calendar event
      const event = await this.calendarEventRepository.create(
        {
          user: { connect: { id: userId } },
          type: CalendarEventType.unavailability,
          title: "Activity Paused",
          description,
          startDateTime: startTime,
          endDateTime: endTime,
        } as any,
        tx
      );

      return event;
    });
  }

  /**
   * Resumes user activity by removing all active pause events.
   * Soft deletes all "Activity Paused" unavailability events.
   *
   * @param identity - Current user identity
   * @returns boolean indicating if operation was successful
   */
  async resumeActivity(identity: Identity): Promise<boolean> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const userId = identity.id;
      const now = new Date();

      // Find all future pause events
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 100);

      const pauseEvents =
        await this.calendarEventRepository.findByUserIdAndDateRange(
          userId,
          now,
          farFuture,
          tx
        );

      // Filter for pause events (title = 'Activity Paused')
      const activePauseEvents = pauseEvents.filter(
        (event) =>
          event.type === CalendarEventType.unavailability &&
          event.title === "Activity Paused" &&
          !event.deletedAt
      );

      // Soft delete each pause event
      for (const event of activePauseEvents) {
        await this.calendarEventRepository.softDelete(event.id, tx);
      }

      return true;
    });
  }
}
