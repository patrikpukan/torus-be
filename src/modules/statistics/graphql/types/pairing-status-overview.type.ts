import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class PairingStatusOverviewType {
  @Field(() => String)
  status: string;

  @Field(() => Int)
  count: number;
}
