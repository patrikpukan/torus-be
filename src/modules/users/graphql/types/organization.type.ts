import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Organization')
export class OrganizationType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field(() => String, { nullable: true })
  imageUrl?: string | null;
}
