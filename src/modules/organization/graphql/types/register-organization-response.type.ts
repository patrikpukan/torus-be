import { Field, ObjectType } from "@nestjs/graphql";
import { OrganizationType } from "./organization.type";

@ObjectType()
export class RegisterOrganizationResponseType {
  @Field(() => OrganizationType)
  organization!: OrganizationType;

  @Field()
  adminEmail!: string;

  @Field()
  message!: string;
}
