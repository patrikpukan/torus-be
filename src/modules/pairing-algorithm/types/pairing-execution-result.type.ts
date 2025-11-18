import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("PairingExecutionResult")
export class PairingExecutionResult {
  @Field()
  success!: boolean;

  @Field(() => Int)
  pairingsCreated!: number;

  @Field()
  message!: string;

  @Field(() => Int, { nullable: true })
  unpairedUsers?: number | null;
}
