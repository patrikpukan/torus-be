import { Field, InputType, registerEnumType } from "@nestjs/graphql";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";

export enum PauseDurationType {
  ONE_PERIOD = "ONE_PERIOD",
  N_PERIODS = "N_PERIODS",
  UNTIL_DATE = "UNTIL_DATE",
  INDEFINITE = "INDEFINITE",
}

registerEnumType(PauseDurationType, {
  name: "PauseDurationType",
  description: "Type of activity pause duration",
});

@InputType()
export class PauseActivityInput {
  @Field(() => PauseDurationType)
  @IsEnum(PauseDurationType)
  durationType: PauseDurationType;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  periodsCount?: number;

  @Field({ nullable: true })
  @IsOptional()
  untilDate?: Date;
}
