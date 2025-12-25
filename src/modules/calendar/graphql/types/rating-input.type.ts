import { Field, ID, InputType, Int } from "@nestjs/graphql";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from "class-validator";

@InputType()
export class CreateRatingInputType {
  @Field(() => ID)
  @IsString()
  meetingEventId: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(5)
  stars: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  feedback?: string;
}
