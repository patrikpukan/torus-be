import { Field, InputType, Int } from "@nestjs/graphql";

@InputType()
export class UpdateAlgorithmSettingsInput {
  @Field()
  organizationId!: string;

  @Field(() => Int, { nullable: true })
  periodLengthDays?: number | null;

  @Field(() => Int, { nullable: true })
  randomSeed?: number | null;
}
