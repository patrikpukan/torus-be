import { execSync } from 'child_process';

/**
 * Synchronizes the Prisma schema with the database using 'prisma db push'.
 * Intended for development environments.
 *
 * @throws {Error} If the schema sync fails.
 */
export function syncPrismaSchema(): void {
  try {
    execSync('npx prisma db push', { stdio: 'inherit' });
    console.log('Database schema synced with Prisma schema.');
  } catch (error) {
    console.error('Failed to sync database schema:', error);
    throw error;
  }
}
