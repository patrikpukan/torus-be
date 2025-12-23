import { Field, ID, ObjectType, Float, Int } from "@nestjs/graphql";
import { RatingType } from "../../../calendar/graphql/types/rating.type";

@ObjectType()
export class UserReceivedRatingsType {
  @Field(() => ID)
  userId: string;

  @Field(() => Float, { nullable: true })
  averageRating?: number | null;

  @Field(() => Int)
  totalRatings: number;

  @Field(() => [RatingType])
  ratings: RatingType[];
}
