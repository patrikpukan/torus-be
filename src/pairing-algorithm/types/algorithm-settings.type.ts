import { Field, GraphQLISODateTime, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("AlgorithmSettings")
export class AlgorithmSettingsType {
  @Field()
  id!: string;

  @Field()
  organizationId!: string;

  @Field(() => Int)
  periodLengthDays!: number;

  @Field(() => Int)
  randomSeed!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType("AlgorithmSettingsResponse")
export class AlgorithmSettingsResponse extends AlgorithmSettingsType {
  @Field({ nullable: true })
  warning?: string | null;
}
