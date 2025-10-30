import { Field, ID, InputType } from "@nestjs/graphql";

@InputType()
export class UpdateOrganizationInputType {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => Number, { nullable: true })
  size?: number | null;

  @Field(() => String, { nullable: true })
  address?: string | null;

  @Field(() => String, { nullable: true })
  imageUrl?: string | null;
}
