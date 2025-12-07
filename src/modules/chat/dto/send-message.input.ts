import { InputType, Field, ID } from "@nestjs/graphql";
import { IsString, IsUUID, MinLength } from "class-validator";

@InputType()
export class SendMessageInput {
  @Field(() => ID)
  @IsUUID()
  pairingId: string;

  @Field()
  @IsString()
  @MinLength(1)
  content: string;
}
