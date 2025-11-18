import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";
import { PairingPeriodStatus } from "@prisma/client";

registerEnumType(PairingPeriodStatus, {
  name: "PairingPeriodStatusEnum",
});

@ObjectType("PairingPeriod")
export class PairingPeriodType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  organizationId!: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endDate?: Date | null;

  @Field(() => PairingPeriodStatus)
  status!: PairingPeriodStatus;
}
