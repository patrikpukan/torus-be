import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RRuleSet, rrulestr } from "rrule";
import { PrismaService } from "src/core/prisma/prisma.service";
import { withRls } from "src/db/withRls";
import { getRlsClaims } from "src/shared/auth/utils/get-rls-claims";
import { Identity } from "src/shared/auth/domain/identity";
import { CalendarEventRepository } from "../repositories/calendar-event.repository";
import {
  CalendarEvent,
  CalendarEventType,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "../domain/calendar-event";

@Injectable()
export class CalendarEventService {
  private readonly logger = new Logger(CalendarEventService.name);

  constructor(
    private readonly calendarEventRepository: CalendarEventRepository,
    private readonly prisma: PrismaService
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
        occurrences.push({
          id: event.id,
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
    scope: "this" | "following" | "all" = "this"
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
          return this.updateThisOccurrence(event, id, input, tx);
        case "following":
          return this.updateFollowingOccurrences(event, id, input, tx);
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
    tx: Prisma.TransactionClient
  ): Promise<CalendarEvent> {
    // Create a new event with the updated details and same rruleRecurringId
    return this.calendarEventRepository.create(
      {
        user: { connect: { id: event.userId } },
        type: (input.type || event.type) as any,
        title: input.title !== undefined ? input.title : event.title,
        description:
          input.description !== undefined
            ? input.description
            : event.description,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        rrule: null, // This is now a single occurrence
        rruleRecurringId: event.rruleRecurringId, // Keep same series ID for reference
      } as any,
      tx
    );
  }

  /**
   * Update following occurrences by modifying RRULE until date
   */
  private async updateFollowingOccurrences(
    event: CalendarEvent,
    id: string,
    input: UpdateCalendarEventInput,
    tx: Prisma.TransactionClient
  ): Promise<CalendarEvent[]> {
    if (!event.rrule) {
      throw new BadRequestException(
        "Cannot update following occurrences for non-recurring event"
      );
    }

    // Modify original event's RRULE to end before this occurrence
    const originalUntilDate = new Date(event.startDateTime);
    originalUntilDate.setDate(originalUntilDate.getDate() - 1);

    const updatedOriginal = await this.calendarEventRepository.update(
      id,
      {
        rrule: this.addUntilToRrule(event.rrule, originalUntilDate),
      },
      tx
    );

    // Create new recurring event for updated portion
    const newEvent = await this.calendarEventRepository.create(
      {
        user: { connect: { id: event.userId } },
        type: (input.type || event.type) as any,
        title: input.title !== undefined ? input.title : event.title,
        description:
          input.description !== undefined
            ? input.description
            : event.description,
        startDateTime: input.startDateTime || event.startDateTime,
        endDateTime: input.endDateTime || event.endDateTime,
        rrule: this.removeUntilFromRrule(event.rrule),
        rruleRecurringId: event.rruleRecurringId,
      } as any,
      tx
    );

    return [updatedOriginal, newEvent];
  }

  /**
   * Update all occurrences by updating original recurring event
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
        ...(input.startDateTime && { startDateTime: input.startDateTime }),
        ...(input.endDateTime && { endDateTime: input.endDateTime }),
      },
      tx
    );
  }

  async deleteCalendarEvent(
    identity: Identity,
    id: string,
    scope: "this" | "following" | "all" = "this"
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
          await this.deleteThisOccurrence(event, id, tx);
          break;
        case "following":
          await this.deleteFollowingOccurrences(event, id, tx);
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
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const exceptionDates = event.exceptionDates
      ? JSON.parse(event.exceptionDates)
      : [];
    exceptionDates.push(event.startDateTime.toISOString());

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
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const untilDate = new Date(event.startDateTime);
    untilDate.setDate(untilDate.getDate() - 1);

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
    // Add new UNTIL
    return `${modifiedRrule};UNTIL=${untilDate.toISOString().split("T")[0].replace(/-/g, "")}`;
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
}
