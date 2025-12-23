import { Field, ID, InputType } from "@nestjs/graphql";

@InputType("ResolveReportInput")
export class ResolveReportInputType {
  @Field(() => ID)
  reportId!: string;

  @Field(() => String, { nullable: true })
  resolutionNote?: string | null;
}
