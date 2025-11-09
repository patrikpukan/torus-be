import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class PairingStatusByUserType {
  @Field(() => ID)
  userId: string;

  @Field(() => String)
  userEmail: string;

  @Field(() => String, { nullable: true })
  userName?: string | null;

  @Field(() => String)
  status: string;

  @Field(() => Int)
  count: number;
}

