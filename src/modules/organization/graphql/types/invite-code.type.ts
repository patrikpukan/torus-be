import { Field, ID, ObjectType } from "@nestjs/graphql";
import { UserType } from "../../../users/graphql/types/user.type";

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

  @Field(() => UserType, { nullable: true })
  createdBy?: UserType;

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
