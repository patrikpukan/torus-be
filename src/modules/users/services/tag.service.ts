import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../core/prisma/prisma.service";
import { TagCategory } from "../graphql/types/tag-category.enum";

@Injectable()
export class TagService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all tags from the database, ordered by name
   */
  async getAllTags(): Promise<any[]> {
    const db = this.prisma as any;
    return db.tag.findMany({
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get tags filtered by category, ordered by name
   */
  async getTagsByCategory(category: TagCategory): Promise<any[]> {
    const db = this.prisma as any;
    return db.tag.findMany({
      where: { category },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Create a new tag if it doesn't already exist
   */
  async createTag(name: string, category: TagCategory): Promise<any> {
    const db = this.prisma as any;
    const trimmedName = name.trim();

    // Check if tag already exists
    const existingTag = await db.tag.findFirst({
      where: { name: trimmedName },
    });

    if (existingTag) {
      throw new Error(`Tag already exists: ${trimmedName}`);
    }

    return db.tag.create({
      data: {
        name: trimmedName,
        category,
      },
    });
  }
}
