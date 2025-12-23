import { UseGuards, ForbiddenException, Injectable } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { User } from "src/shared/auth/decorators/user.decorator";
import type { Identity } from "src/shared/auth/domain/identity";
import { AuthenticatedUserGuard } from "src/shared/auth/guards/authenticated-user.guard";
import { CaslAbilityFactory } from "src/shared/auth/casl/casl-ability.factory";
import { RatingService } from "../../services/rating.service";
import { RatingType } from "../types/rating.type";
import { UnratedMeetingType } from "../types/unrated-meeting.type";
import { CreateRatingInputType } from "../types/rating-input.type";
import { UserRoleEnum } from "src/modules/users/domain/user";

@Resolver(() => RatingType)
@UseGuards(AuthenticatedUserGuard)
export class RatingResolver {
  constructor(
    private readonly ratingService: RatingService,
    private readonly caslAbilityFactory: CaslAbilityFactory
  ) {}

  @Mutation(() => RatingType, {
    description: "Rate a meeting you participated in",
  })
  async createRating(
    @User() identity: Identity,
    @Args("input") input: CreateRatingInputType
  ): Promise<RatingType> {
    const rating = await this.ratingService.createRating(identity, input);
    return this.mapRatingToGraphQL(rating);
  }

  @Query(() => [RatingType], {
    description: "Get all ratings created by the current user",
  })
  async myRatings(@User() identity: Identity): Promise<RatingType[]> {
    const ratings = await this.ratingService.getUserRatings(identity);
    return ratings.map((r) => this.mapRatingToGraphQL(r));
  }

  @Query(() => [UnratedMeetingType], {
    description: "Get meetings that can still be rated by the current user",
  })
  async unratedMeetings(@User() identity: Identity): Promise<UnratedMeetingType[]> {
    const unrated = await this.ratingService.getUnratedMeetings(identity);
    return unrated.map((m) => ({
      id: m.id,
      startDateTime: m.startDateTime,
      endDateTime: m.endDateTime,
      userAId: m.userAId,
      userBId: m.userBId,
      userA: {
        id: m.userA.id,
        firstName: m.userA.firstName,
        lastName: m.userA.lastName,
      },
      userB: {
        id: m.userB.id,
        firstName: m.userB.firstName,
        lastName: m.userB.lastName,
      },
    }));
  }

  @Query(() => [RatingType], {
    description: "Get all ratings for a specific meeting (admin only)",
  })
  async meetingRatings(
    @User() identity: Identity,
    @Args("meetingEventId", { type: () => ID }) meetingEventId: string
  ): Promise<RatingType[]> {
    // Only org admins and super admins can view all ratings for a meeting
    const ability = this.caslAbilityFactory.createForUser(identity);

    if (
      !ability.can("read", "Rating") &&
      identity.role !== UserRoleEnum.org_admin &&
      identity.role !== UserRoleEnum.super_admin
    ) {
      throw new ForbiddenException(
        "You do not have permission to view meeting ratings"
      );
    }

    const ratings = await this.ratingService.getMeetingRatings(meetingEventId);
    return ratings.map((r) => this.mapRatingToGraphQL(r));
  }

  private mapRatingToGraphQL(rating: any): RatingType {
    return {
      id: rating.id,
      meetingEventId: rating.meetingEventId,
      meetingEvent: rating.meetingEvent,
      userId: rating.userId,
      stars: rating.stars,
      feedback: rating.feedback || undefined,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
    };
  }
}
