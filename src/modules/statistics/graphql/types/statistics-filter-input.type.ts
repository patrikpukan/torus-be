import { Field, InputType, Int } from "@nestjs/graphql";

@InputType()
export class StatisticsFilterInputType {
  @Field(() => String, { nullable: true })
  startDate?: string;

  @Field(() => String, { nullable: true })
  endDate?: string;

  @Field(() => Int, { nullable: true })
  month?: number;

  @Field(() => Int, { nullable: true })
  year?: number;

  @Field(() => String, { nullable: true })
  organizationId?: string;
}

