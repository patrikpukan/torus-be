import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CalendarEvent, CalendarEventType } from "../domain/calendar-event";

@Injectable()
export class CalendarEventRepository {
  async create(
    input: Prisma.CalendarEventCreateInput,
    tx: Prisma.TransactionClient
  ): Promise<CalendarEvent> {
    return tx.calendarEvent.create({
      data: input,
    });
  }

  async findById(
    id: string,
    tx: Prisma.TransactionClient
  ): Promise<CalendarEvent | null> {
    return tx.calendarEvent.findUnique({
      where: { id },
    });
  }

  async findByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    tx: Prisma.TransactionClient
  ): Promise<CalendarEvent[]> {
    return tx.calendarEvent.findMany({
      where: {
        userId,
        deletedAt: null,
        OR: [
          // Event starts or ends within range
          {
            startDateTime: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            endDateTime: {
              gte: startDate,
              lte: endDate,
            },
          },
          // Event spans the entire range
          {
            startDateTime: {
              lte: startDate,
            },
            endDateTime: {
              gte: endDate,
            },
          },
        ],
      },
      orderBy: { startDateTime: "asc" },
    });
  }

  async findRecurringSeries(
    rruleRecurringId: string,
    tx: Prisma.TransactionClient
  ): Promise<CalendarEvent[]> {
    return tx.calendarEvent.findMany({
      where: {
        rruleRecurringId,
      },
      orderBy: { startDateTime: "asc" },
    });
  }

  async update(
    id: string,
    input: Prisma.CalendarEventUpdateInput,
    tx: Prisma.TransactionClient
  ): Promise<CalendarEvent> {
    return tx.calendarEvent.update({
      where: { id },
      data: input,
    });
  }

  async softDelete(
    id: string,
    tx: Prisma.TransactionClient
  ): Promise<CalendarEvent> {
    return tx.calendarEvent.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findByUserAndType(
    userId: string,
    type: CalendarEventType,
    tx: Prisma.TransactionClient
  ): Promise<CalendarEvent[]> {
    return tx.calendarEvent.findMany({
      where: {
        userId,
        type,
        deletedAt: null,
      },
      orderBy: { startDateTime: "asc" },
    });
  }
}
