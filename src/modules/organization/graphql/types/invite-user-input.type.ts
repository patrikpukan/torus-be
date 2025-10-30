import { Field, InputType } from "@nestjs/graphql";

@InputType()
export class InviteUserInputType {
  @Field()
  email!: string;

  @Field()
  organizationId!: string;
}
