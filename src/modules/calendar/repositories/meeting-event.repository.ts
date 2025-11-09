import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MeetingEvent } from "../domain/meeting-event";

@Injectable()
export class MeetingEventRepository {
  async create(
    input: Prisma.MeetingEventCreateInput,
    tx: Prisma.TransactionClient
  ): Promise<MeetingEvent> {
    return tx.meetingEvent.create({
      data: input,
    });
  }

  async findById(
    id: string,
    tx: Prisma.TransactionClient
  ): Promise<MeetingEvent | null> {
    return tx.meetingEvent.findUnique({
      where: { id },
    });
  }

  async findByPairingId(
    pairingId: string,
    tx: Prisma.TransactionClient
  ): Promise<MeetingEvent | null> {
    // Get the latest meeting event for this pairing (not cancelled)
    return tx.meetingEvent.findFirst({
      where: {
        pairingId,
        cancelledAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByPairingIdAll(
    pairingId: string,
    tx: Prisma.TransactionClient
  ): Promise<MeetingEvent[]> {
    // Get all meeting events for a pairing
    return tx.meetingEvent.findMany({
      where: {
        pairingId,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByUserAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    tx: Prisma.TransactionClient
  ): Promise<MeetingEvent[]> {
    return tx.meetingEvent.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        cancelledAt: null,
        startDateTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { startDateTime: "asc" },
    });
  }

  async findUpcomingForUser(
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<MeetingEvent[]> {
    const now = new Date();
    return tx.meetingEvent.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        cancelledAt: null,
        startDateTime: {
          gte: now,
        },
      },
      orderBy: { startDateTime: "asc" },
    });
  }

  async findPendingConfirmationsForUser(
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<MeetingEvent[]> {
    return tx.meetingEvent.findMany({
      where: {
        cancelledAt: null,
        OR: [
          {
            userBId: userId,
            userBConfirmationStatus: "pending",
          },
          {
            userAId: userId,
            userAConfirmationStatus: "pending",
          },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async update(
    id: string,
    input: Prisma.MeetingEventUpdateInput,
    tx: Prisma.TransactionClient
  ): Promise<MeetingEvent> {
    return tx.meetingEvent.update({
      where: { id },
      data: input,
    });
  }

  async softCancel(
    id: string,
    cancelledByUserId: string,
    reason?: string,
    tx?: Prisma.TransactionClient
  ): Promise<MeetingEvent> {
    if (!tx) {
      throw new Error("Transaction client is required");
    }
    return (tx as any).meetingEvent.update({
      where: { id },
      data: {
        cancelledAt: new Date(),
        cancelledByUserId,
        cancellationReason: reason,
      },
    });
  }
}
