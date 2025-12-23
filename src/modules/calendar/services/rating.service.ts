import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "src/core/prisma/prisma.service";
import { withRls } from "src/db/withRls";
import { getRlsClaims } from "src/shared/auth/utils/get-rls-claims";
import { Identity } from "src/shared/auth/domain/identity";
import { RatingRepository } from "../repositories/rating.repository";
import type { Rating, CreateRatingInput } from "../domain/rating";

@Injectable()
export class RatingService {
  private readonly logger = new Logger(RatingService.name);
  private readonly TWO_HOURS_MS = 2 * 60 * 60 * 1000;

  constructor(
    private readonly ratingRepository: RatingRepository,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Check if a user can rate a meeting
   */
  private async canRateMeeting(
    userId: string,
    meetingEventId: string,
    tx?: any
  ): Promise<void> {
    const client = tx || this.prisma;

    const meeting = await client.meetingEvent.findUnique({
      where: { id: meetingEventId },
    });

    if (!meeting) {
      throw new NotFoundException("Meeting not found");
    }

    // Check if user is a participant
    if (meeting.userAId !== userId && meeting.userBId !== userId) {
      throw new ForbiddenException(
        "You must be a participant to rate this meeting"
      );
    }

    // Check if meeting was cancelled
    if (meeting.cancelledAt) {
      throw new BadRequestException("Cannot rate a cancelled meeting");
    }

    // Check if meeting has already occurred + 2 hour buffer
    const now = new Date();
    const bufferEnd = new Date(
      meeting.endDateTime.getTime() + this.TWO_HOURS_MS
    );

    if (now < bufferEnd) {
      throw new BadRequestException(
        "Meeting can only be rated 2 hours after it ends"
      );
    }

    // Check if already rated
    const existingRating = await this.ratingRepository.findByMeetingAndUser(
      meetingEventId,
      userId
    );

    if (existingRating) {
      throw new BadRequestException("You have already rated this meeting");
    }
  }

  /**
   * Create a rating for a meeting
   */
  async createRating(
    identity: Identity,
    input: CreateRatingInput
  ): Promise<Rating> {
    this.logger.log(
      `Creating rating - userId: ${identity.id}, meetingEventId: ${input.meetingEventId}, stars: ${input.stars}`
    );

    // Validate stars
    if (input.stars < 0 || input.stars > 5) {
      throw new BadRequestException("Stars must be between 0 and 5");
    }

    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      // Check authorization
      await this.canRateMeeting(identity.id, input.meetingEventId, tx);

      // Create rating
      const rating = await this.ratingRepository.create(identity.id, input, tx);

      this.logger.log(`Rating created - ratingId: ${rating.id}`);
      return rating;
    });
  }

  /**
   * Get all ratings created by a user
   */
  async getUserRatings(identity: Identity): Promise<Rating[]> {
    this.logger.log(`Getting ratings for user: ${identity.id}`);

    return this.ratingRepository.findUserRatings(identity.id);
  }

  /**
   * Get all ratings for a specific meeting (admin only - checked in resolver)
   */
  async getMeetingRatings(meetingEventId: string): Promise<Rating[]> {
    this.logger.log(`Getting ratings for meeting: ${meetingEventId}`);

    const meeting = await this.prisma.meetingEvent.findUnique({
      where: { id: meetingEventId },
    });

    if (!meeting) {
      throw new NotFoundException("Meeting not found");
    }

    return this.ratingRepository.findMeetingRatings(meetingEventId);
  }

  /**
   * Get meetings that a user can still rate
   */
  async getUnratedMeetings(identity: Identity): Promise<any[]> {
    this.logger.log(`Getting unrated meetings for user: ${identity.id}`);

    return this.ratingRepository.findUnratedMeetingsForUser(identity.id);
  }
}
