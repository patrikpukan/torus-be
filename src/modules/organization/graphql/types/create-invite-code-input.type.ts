import { Field, InputType } from "@nestjs/graphql";

@InputType()
export class CreateInviteCodeInputType {
  @Field({ nullable: true, description: "Optional: max uses for this code" })
  maxUses?: number;

  @Field({
    nullable: true,
    description:
      "Optional: hours until code expires (default: 30 days if not set)",
  })
  expiresInHours?: number;
}
