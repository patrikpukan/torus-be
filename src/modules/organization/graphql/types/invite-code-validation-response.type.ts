import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class InviteCodeValidationResponseType {
  @Field()
  isValid: boolean;

  @Field()
  message: string;

  @Field({ nullable: true })
  organizationId?: string;

  @Field({ nullable: true })
  organizationName?: string;

  @Field({ nullable: true })
  expiresAt?: Date;

  @Field({ nullable: true })
  remainingUses?: number;
}
