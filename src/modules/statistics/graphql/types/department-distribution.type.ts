import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class DepartmentDistributionItemType {
  @Field()
  departmentName: string;

  @Field(() => Int)
  userCount: number;
}

@ObjectType()
export class DepartmentDistributionResponseType {
  @Field(() => [DepartmentDistributionItemType])
  departments: DepartmentDistributionItemType[];

  @Field(() => Int)
  totalUsers: number;
}
