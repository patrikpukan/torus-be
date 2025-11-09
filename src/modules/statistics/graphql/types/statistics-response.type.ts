import { Field, Int, ObjectType } from "@nestjs/graphql";
import { PairingStatusOverviewType } from "./pairing-status-overview.type";
import { PairingStatusByUserType } from "./pairing-status-by-user.type";

@ObjectType()
export class StatisticsResponseType {
  @Field(() => [PairingStatusOverviewType])
  pairingsByStatus: PairingStatusOverviewType[];

  @Field(() => [PairingStatusByUserType])
  pairingsByStatusAndUser: PairingStatusByUserType[];

  @Field(() => Int)
  newUsersCount: number;

  @Field(() => Int)
  reportsCount: number;

  @Field(() => Int)
  inactiveUsersCount: number;
}

