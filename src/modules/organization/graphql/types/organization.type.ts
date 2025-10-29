import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class OrganizationType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field(() => Number, { nullable: true })
  size?: number | null;

  @Field(() => String, { nullable: true })
  address?: string | null;

  @Field(() => String, { nullable: true })
  imageUrl?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
