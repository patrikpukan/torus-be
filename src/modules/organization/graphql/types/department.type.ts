import { Field, ID, ObjectType, GraphQLISODateTime } from "@nestjs/graphql";

@ObjectType("Department")
export class DepartmentType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => ID)
  organizationId!: string;

  @Field(() => Number)
  employeeCount!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
