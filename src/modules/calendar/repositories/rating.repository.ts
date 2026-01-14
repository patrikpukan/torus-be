import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "src/core/prisma/prisma.service";
import type { Rating, CreateRatingInput } from "../domain/rating";

@Injectable()
export class RatingRepository {
  private readonly logger = new Logger(RatingRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    input: CreateRatingInput,
    tx?: any
  ): Promise<Rating> {
    const client = tx || this.prisma;

    const result = await client.rating.create({
      data: {
        userId,
        meetingEventId: input.meetingEventId,
        stars: input.stars,
        feedback: input.feedback || null,
      },
    });

    return this.mapToDomain(result);
  }

  async findByMeetingAndUser(
    meetingEventId: string,
    userId: string
  ): Promise<Rating | null> {
    const result = await this.prisma.rating.findUnique({
      where: {
        meetingEventId_userId: {
          meetingEventId,
          userId,
        },
      },
    });

    return result ? this.mapToDomain(result) : null;
  }

  async findUserRatings(userId: string): Promise<Rating[]> {
    const results = await this.prisma.rating.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return results.map((r) => this.mapToDomain(r));
  }

  async findMeetingRatings(meetingEventId: string): Promise<Rating[]> {
    const results = await this.prisma.rating.findMany({
      where: { meetingEventId },
    });

    return results.map((r) => this.mapToDomain(r));
  }

  async findUnratedMeetingsForUser(userId: string): Promise<any[]> {
    // Find meetings where this user participated and hasn't rated yet
    return this.prisma.meetingEvent.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        // Meeting must have occurred + 2 hour buffer
        endDateTime: {
          lte: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        // User hasn't rated yet
        NOT: {
          ratings: {
            some: {
              userId,
            },
          },
        },
        // Meeting wasn't cancelled
        cancelledAt: null,
      },
      orderBy: { endDateTime: "desc" },
      include: {
        userA: { select: { id: true, firstName: true, lastName: true } },
        userB: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findReceivedRatings(receivedByUserId: string): Promise<any[]> {
    // Find all ratings received by a user (ratings given by others for meetings where this user participated)
    const results = await this.prisma.rating.findMany({
      where: {
        AND: [
          // User must be a participant in the meeting
          {
            meetingEvent: {
              OR: [{ userAId: receivedByUserId }, { userBId: receivedByUserId }],
            },
          },
          // But the rating must be given BY someone else (not the user themselves)
          {
            userId: {
              not: receivedByUserId,
            },
          },
        ],
      },
      include: {
        meetingEvent: {
          include: {
            userA: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            userB: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, profileImageUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return results;
  }

  private mapToDomain(raw: any): Rating {
    return {
      id: raw.id,
      meetingEventId: raw.meetingEventId,
      userId: raw.userId,
      stars: raw.stars,
      feedback: raw.feedback || undefined,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
