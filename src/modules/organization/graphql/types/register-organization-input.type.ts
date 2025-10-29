import { Field, InputType, Int } from "@nestjs/graphql";

@InputType()
export class RegisterOrganizationInputType {
  @Field()
  adminEmail!: string;

  @Field()
  organizationName!: string;

  @Field(() => String)
  organizationSize!: string;

  @Field()
  organizationAddress!: string;
}
