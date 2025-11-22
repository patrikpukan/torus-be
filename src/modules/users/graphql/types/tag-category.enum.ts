import { registerEnumType } from "@nestjs/graphql";

export enum TagCategory {
  HOBBY = "HOBBY",
  INTEREST = "INTEREST",
}

registerEnumType(TagCategory, {
  name: "TagCategory",
  description: "Category of a tag (hobby or interest)",
});
