import { ObjectType, Field, ID } from "@nestjs/graphql";

@ObjectType()
export class TypingStatus {
  @Field(() => ID)
  pairingId: string;

  @Field(() => ID)
  userId: string;

  @Field()
  isTyping: boolean;
}
