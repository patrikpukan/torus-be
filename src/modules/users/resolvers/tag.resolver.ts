import { Query, Resolver, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { TagType } from "../graphql/types/tag.type";
import { TagCategory } from "../graphql/types/tag-category.enum";
import { TagService } from "../services/tag.service";
import { AuthenticatedUserGuard } from "../../../shared/auth/guards/authenticated-user.guard";

@Resolver(() => TagType)
export class TagResolver {
  constructor(private readonly tagService: TagService) {}

  @Query(() => [TagType])
  @UseGuards(AuthenticatedUserGuard)
  async getAllTags(): Promise<TagType[]> {
    return this.tagService.getAllTags();
  }

  @Query(() => [TagType])
  @UseGuards(AuthenticatedUserGuard)
  async getTagsByCategory(
    @Args("category", { type: () => TagCategory }) category: TagCategory
  ): Promise<TagType[]> {
    return this.tagService.getTagsByCategory(category);
  }
}
