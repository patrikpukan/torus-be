import { ObjectType, Field, ID } from "@nestjs/graphql";

@ObjectType()
export class MessageModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  pairingId: string;

  @Field(() => ID)
  senderId: string;

  @Field()
  content: string;

  @Field()
  isRead: boolean;

  @Field()
  createdAt: Date;
}
