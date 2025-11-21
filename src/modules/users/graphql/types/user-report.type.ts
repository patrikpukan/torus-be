import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";
import { ReportStatusEnum } from "../../domain/user-report";
import { UserType } from "./user.type";

registerEnumType(ReportStatusEnum, {
  name: "ReportStatusEnum",
});

@ObjectType("UserReport")
export class UserReportType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  reporterId!: string;

  @Field(() => ID)
  reportedUserId!: string;

  @Field(() => ID)
  pairingId!: string;

  @Field()
  reason!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => ReportStatusEnum)
  status!: ReportStatusEnum;

  @Field(() => UserType)
  reporter!: UserType;

  @Field(() => UserType)
  reportedUser!: UserType;

  @Field(() => UserType, { nullable: true })
  resolvedBy?: UserType | null;

  @Field(() => String, { nullable: true })
  resolutionNote?: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  resolvedAt?: Date | null;
}
