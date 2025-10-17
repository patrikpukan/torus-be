import { Controller, Get } from '@nestjs/common';
import { SeedService } from './seed.service';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  /**
   * Syncs the database schema and seeds the database with initial data (removes all currently present data.)
   */
  @Get()
  async seed(): Promise<{
    success: boolean;
    message: string;
    error?: string;
    timestamp: string;
  }> {
    try {
      await this.seedService.run();
      return {
        success: true,
        message: 'Seed completed successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      console.error('Error seeding data:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: 'Seed failed',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
