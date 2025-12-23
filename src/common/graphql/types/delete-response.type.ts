import { Field, ObjectType } from "@nestjs/graphql";

/**
 * Standard response type for delete operations.
 * Provides consistent feedback on deletion success/failure.
 */
@ObjectType("DeleteResponse")
export class DeleteResponseType {
  @Field()
  success!: boolean;

  @Field()
  message!: string;

  @Field({ nullable: true })
  deletedId?: string;

  @Field({ nullable: true })
  deletedCount?: number;
}
