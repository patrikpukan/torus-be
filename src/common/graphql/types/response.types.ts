import { Field, ObjectType } from "@nestjs/graphql";

/**
 * Base GraphQL response type for mutations that don't return data.
 */
@ObjectType("MutationResponse")
export class MutationResponseType {
  @Field()
  success!: boolean;

  @Field()
  message!: string;
}

/**
 * Generic response wrapper for mutations that return data.
 * Each mutation should create a specific instance of this type.
 */
@ObjectType("DataResponse")
export class DataResponseType<T> {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field()
  data!: T;
}

/**
 * Response for list operations with pagination.
 */
@ObjectType("PaginatedResponse")
export class PaginatedResponseType<T> {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => [Object])
  data!: T[];

  @Field()
  total!: number;

  @Field()
  page!: number;

  @Field()
  pageSize!: number;
}

/**
 * Response for validation operations.
 */
@ObjectType("ValidatedResponse")
export class ValidatedResponseType {
  @Field()
  success!: boolean;

  @Field()
  message!: string;

  @Field({ nullable: true })
  isValid?: boolean;
}
