import { Field, InputType, Int, GraphQLISODateTime } from "@nestjs/graphql";

@InputType()
export class UpdateAlgorithmSettingsInput {
  @Field()
  organizationId!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  startDate?: Date | null;

  @Field(() => Int, { nullable: true })
  periodLengthDays?: number | null;

  @Field(() => Int, { nullable: true })
  randomSeed?: number | null;
}
