import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class SimpleOrganizationType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field(() => String, { nullable: true })
  imageUrl?: string | null;
}
