import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class InviteCodeType {
  @Field(() => ID)
  id: string;

  @Field()
  code: string;

  @Field()
  organizationId: string;

  @Field()
  createdById: string;

  @Field()
  createdAt: Date;

  @Field({ nullable: true })
  expiresAt?: Date;

  @Field()
  usedCount: number;

  @Field({ nullable: true })
  maxUses?: number;

  @Field()
  isActive: boolean;

  @Field()
  inviteUrl: string; // Generated URL for convenience
}
