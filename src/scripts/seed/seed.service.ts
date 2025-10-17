import { join } from 'path';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { BetterAuth } from '../../shared/auth/providers/better-auth.provider';
import { Config } from '../../shared/config/config.service';
import { seedDatabase } from './seed/seed-database';
import { getProjectRoot } from './utils/get-project-root';
import { seedDirToStorage } from './utils/seed-dir-to-storage';
import { syncPrismaSchema } from './utils/sync-prisma-schema';

const projectRoot = getProjectRoot();
const uploadDir = join(projectRoot, 'uploads/profile-pictures');
const seedImagesDir = join(projectRoot, 'src/scripts/seed/seed/images');

console.log('Resolved projectRoot:', projectRoot);
console.log('Resolved uploadDir:', uploadDir);
console.log('Resolved seedImagesDir:', seedImagesDir);

/**
 * Service for seeding the database and storage with initial data.
 */
@Injectable()
export class SeedService {
  constructor(
    private readonly config: Config,
    private readonly prisma: PrismaService,
    @Inject('BetterAuth') private readonly betterAuth: BetterAuth,
  ) {}

  /**
   * Runs the seed process: syncs schema, seeds storage, and seeds database.
   */
  async run(): Promise<void> {
    try {
      // delete this for production deployment (use Prisma migrations instead)
      await syncPrismaSchema();
      await seedDirToStorage(seedImagesDir, uploadDir);
      await seedDatabase(this.prisma, this.config, this.betterAuth);
    } catch (error) {
      console.error('Error seeding data:', error);
      process.exit(1);
    }
  }
}
