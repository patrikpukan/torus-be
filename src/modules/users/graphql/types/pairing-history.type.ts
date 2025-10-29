import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql";
import { UserType } from "./user.type";

export enum PairingStatusEnum {
  planned = "planned",
  matched = "matched",
  met = "met",
  not_met = "not_met",
  cancelled = "cancelled",
}

registerEnumType(PairingStatusEnum, {
  name: "PairingStatusEnum",
  description: "Pairing status",
});

@ObjectType("PairingHistory")
export class PairingHistoryType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  userAId!: string;

  @Field(() => ID)
  userBId!: string;

  @Field(() => PairingStatusEnum)
  status!: PairingStatusEnum;

  @Field()
  createdAt!: Date;

  @Field(() => UserType)
  userA!: UserType;

  @Field(() => UserType)
  userB!: UserType;
}
