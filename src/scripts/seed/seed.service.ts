import { join } from "path";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../core/prisma/prisma.service";
import { Config } from "../../shared/config/config.service";
import { seedDatabase } from "./seed/seed-database";
import { getProjectRoot } from "./utils/get-project-root";
import { seedDirToStorage } from "./utils/seed-dir-to-storage";

const projectRoot = getProjectRoot();
const uploadDir = join(projectRoot, "uploads/profile-pictures");
const seedImagesDir = join(projectRoot, "src/scripts/seed/seed/images");

console.log("Resolved projectRoot:", projectRoot);
console.log("Resolved uploadDir:", uploadDir);
console.log("Resolved seedImagesDir:", seedImagesDir);

/**
 * Service for seeding the database and storage with initial data.
 */
@Injectable()
export class SeedService {
  constructor(
    private readonly config: Config,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Runs the seed process: syncs schema, seeds storage, and seeds database.
   */
  async run(): Promise<void> {
    try {
      // Migrations already applied. Skip schema sync during seed to avoid engine conflicts.
      await seedDirToStorage(seedImagesDir, uploadDir);
      await seedDatabase(this.prisma, this.config);
    } catch (error) {
      console.error("Error seeding data:", error);
      process.exit(1);
    }
  }
}
