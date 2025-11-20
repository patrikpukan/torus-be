import { Field, ID, InputType } from "@nestjs/graphql";

@InputType("ReportUserInput")
export class ReportUserInputType {
  @Field(() => ID)
  reportedUserId!: string;

  @Field()
  reason!: string;
}

