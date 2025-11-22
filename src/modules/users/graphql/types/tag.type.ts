import { Field, ID, ObjectType, GraphQLISODateTime } from "@nestjs/graphql";
import { TagCategory } from "./tag-category.enum";

@ObjectType("Tag")
export class TagType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => TagCategory)
  category!: TagCategory;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
