import { Field, InputType } from "@nestjs/graphql";
import { IsOptional } from "class-validator";
import { TagCategory } from "./tag-category.enum";

@InputType()
export class TagFilterInput {
  @Field(() => TagCategory, { nullable: true })
  @IsOptional()
  category?: TagCategory;
}
