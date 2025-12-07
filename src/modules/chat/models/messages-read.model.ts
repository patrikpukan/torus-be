import { ObjectType, Field, ID } from "@nestjs/graphql";

@ObjectType()
export class MessagesReadEvent {
  @Field(() => ID)
  pairingId: string;

  @Field(() => ID)
  userId: string; // The user who read the messages
}
