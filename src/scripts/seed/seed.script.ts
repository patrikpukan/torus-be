import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed.module';
import { SeedService } from './seed.service';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function main() {
  // Ensure uploads directory exists
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    console.log('Creating uploads directory...');
    mkdirSync(uploadsDir, { recursive: true });
  }

  const app = await NestFactory.createApplicationContext(SeedModule);
  const seedService = app.get(SeedService);
  try {
    await seedService.run();
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void main();
