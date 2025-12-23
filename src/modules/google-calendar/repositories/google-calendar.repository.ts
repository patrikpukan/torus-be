import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../core/prisma/prisma.service";
import { CalendarEventType } from "@prisma/client";

/**
 * Repository for Google Calendar data access.
 * Handles Prisma operations related to calendar syncing and event storage.
 */
@Injectable()
export class GoogleCalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user's Google Calendar integration info
   */
  async getUserGoogleCalendarInfo(userId: string): Promise<{
    id: string;
    email: string;
    accessToken?: string;
    refreshToken?: string;
  } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
      },
    });
  }

  /**
   * Get organization info
   */
  async getOrganization(organizationId: string): Promise<{
    id: string;
    name: string;
  } | null> {
    return this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
      },
    });
  }

  /**
   * Find calendar event by external ID
   */
  async findEventByExternalId(
    userId: string,
    externalId: string
  ): Promise<{
    id: string;
    externalId: string | null;
  } | null> {
    return this.prisma.calendarEvent.findFirst({
      where: {
        userId,
        externalId,
      },
      select: {
        id: true,
        externalId: true,
      },
    });
  }

  /**
   * Get all calendar events for user in a date range
   */
  async getEventsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      id: string;
      title: string | null;
      startDateTime: Date;
      endDateTime: Date;
      externalId: string | null;
    }>
  > {
    return this.prisma.calendarEvent.findMany({
      where: {
        userId,
        AND: [
          {
            startDateTime: {
              lt: endDate,
            },
          },
          {
            endDateTime: {
              gt: startDate,
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        startDateTime: true,
        endDateTime: true,
        externalId: true,
      },
    });
  }

  /**
   * Create calendar event from imported external event
   */
  async createImportedEvent(data: {
    userId: string;
    organizationId: string;
    title: string | null;
    description?: string;
    startDateTime: Date;
    endDateTime: Date;
    externalId: string;
    externalSource: string;
    eventType: CalendarEventType;
    rrule?: string;
    location?: string;
  }): Promise<{ id: string; externalId: string | null }> {
    return this.prisma.calendarEvent.create({
      data: {
        userId: data.userId,
        title: data.title,
        description: data.description,
        startDateTime: data.startDateTime,
        endDateTime: data.endDateTime,
        externalId: data.externalId,
        externalSource: data.externalSource,
        type: data.eventType,
        rrule: data.rrule,
      },
      select: {
        id: true,
        externalId: true,
      },
    });
  }

  /**
   * Update calendar event from external sync
   */
  async updateImportedEvent(
    eventId: string,
    data: {
      title?: string | null;
      description?: string;
      startDateTime?: Date;
      endDateTime?: Date;
      rrule?: string;
    }
  ): Promise<{ id: string }> {
    return this.prisma.calendarEvent.update({
      where: { id: eventId },
      data,
      select: { id: true },
    });
  }

  /**
   * Mark event as synced from external source
   */
  async markEventSynced(
    eventId: string,
    externalSource: string
  ): Promise<{ id: string }> {
    return this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: { externalSource },
      select: { id: true },
    });
  }

  /**
   * Get organization users for calendar sync
   */
  async getOrganizationUsers(organizationId: string): Promise<
    Array<{
      id: string;
      email: string;
    }>
  > {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
      },
    });
  }

  /**
   * Check if calendar event exists
   */
  async eventExists(eventId: string): Promise<boolean> {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    return !!event;
  }

  /**
   * Get imported events count for user
   */
  async getImportedEventCount(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    return this.prisma.calendarEvent.count({
      where: {
        userId,
        externalSource: { not: null },
        startDateTime: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
  }
}
