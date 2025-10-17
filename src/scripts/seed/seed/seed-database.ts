import { PrismaService } from '../../../core/prisma/prisma.service';
import { BetterAuth } from '../../../shared/auth/providers/better-auth.provider';
import { Config } from '../../../shared/config/config.service';
import { createUser } from './create-user';

export const seedDatabase = async (
  prisma: PrismaService,
  config: Config,
  betterAuth: BetterAuth,
): Promise<void> => {
  const auth = betterAuth;

  // Drop existing database data from all tables
  try {
    // In MySQL/MariaDB, we need to disable foreign key checks temporarily
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0;');

    await prisma.$executeRawUnsafe('TRUNCATE TABLE `user`;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE `verification`;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE `account`;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE `session`;');

    // Re-enable foreign key checks
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1;');
  } catch (error) {
    console.error('Error truncating tables:', error);
  }

  console.log('Creating superadmin user');

  // Create a superadmin user. This should be delete in prod app
  await createUser(prisma, auth, {
    email: config.superadminEmail,
    password: config.superadminPassword,
    name: 'Admin (Delete in Prod)',
    username: 'superadmin',
    role: 'admin',
    profilePictureUrl: 'uploads/profile-pictures/superadminavatar.png',
  });

  console.log('Creating example users');

  const user1 = await createUser(prisma, auth, {
    email: 'caffeinatedduck@example.com',
    password: 'password1',
    name: 'Caffeinated Duck',
    username: 'CaffeinatedDuck',
    profilePictureUrl: 'uploads/profile-pictures/caffeduckavatar.png',
  });

  const user2 = await createUser(prisma, auth, {
    email: 'deepduckthoughts@example.com',
    password: 'password2',
    name: 'Deep Duck Thoughts',
    username: 'DeepDuckThoughts',
    profilePictureUrl: 'uploads/profile-pictures/deepduckavatar.png',
  });

  console.log('Creating example quacks');

};
