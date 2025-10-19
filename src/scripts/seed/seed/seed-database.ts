import { randomUUID } from 'crypto';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BetterAuth } from '../../../shared/auth/providers/better-auth.provider';
import { Config } from '../../../shared/config/config.service';
import { createQuack } from './create-quack';
import { createUser } from './create-user';

export const seedDatabase = async (
  prisma: PrismaService,
  config: Config,
  betterAuth: BetterAuth,
): Promise<void> => {
  const auth = betterAuth;
  const db = prisma as any;

  // Drop existing database data from all tables
  try {
    // Delete data using Prisma's deleteMany (respects foreign keys automatically)
    console.log('Deleting existing data...');
    await db.session.deleteMany({});
    await db.account.deleteMany({});
    await db.quack.deleteMany({});
    await db.verification.deleteMany({});
    await db.orgAdmin.deleteMany({});
    await db.user.deleteMany({});
    console.log('All existing data deleted successfully.');
  } catch (error) {
    console.error('Error deleting data:', error);
    throw error; // Re-throw to stop seeding if cleanup fails
  }

  console.log('Creating superadmin user');
  
  // Debug: Check what values we have
  console.log('Debug - config.superadminEmail:', config.superadminEmail);
  console.log('Debug - process.env.SUPERADMIN_EMAIL:', process.env.SUPERADMIN_EMAIL);
  console.log('Debug - config.superadminPassword:', config.superadminPassword ? '[HIDDEN]' : undefined);
  console.log('Debug - process.env.SUPERADMIN_PASSWORD:', process.env.SUPERADMIN_PASSWORD ? '[HIDDEN]' : undefined);
  
  const email = config.superadminEmail || process.env.SUPERADMIN_EMAIL || 'admin@example.com';
  const password = config.superadminPassword || process.env.SUPERADMIN_PASSWORD || 'adminpassword';
  
  console.log('Debug - Using email:', email);
  console.log('Debug - Using password:', password ? '[HIDDEN]' : undefined);

  // Create a superadmin user. This should be delete in prod app
  await createUser(prisma, auth, {
    email,
    password,
    name: 'Admin (Delete in Prod)',
    username: 'superadmin',
    role: 'system_admin',
    profileStatus: 'active',
    profilePictureUrl: 'uploads/profile-pictures/superadminavatar.png',
  });

  console.log('Creating example users');

  const orgAdminEmail = 'caffeinatedduck@example.com';

  await db.orgAdmin.create({
    data: {
      id: randomUUID(),
      email: orgAdminEmail.toLowerCase(),
    },
  });

  const user1 = await createUser(prisma, auth, {
    email: orgAdminEmail,
    password: 'password1',
    name: 'Caffeinated Duck',
    username: 'CaffeinatedDuck',
    role: 'org_admin',
    profileStatus: 'active',
    profilePictureUrl: 'uploads/profile-pictures/caffeduckavatar.png',
  });

  const user2 = await createUser(prisma, auth, {
    email: 'deepduckthoughts@example.com',
    password: 'password2',
    name: 'Deep Duck Thoughts',
    username: 'DeepDuckThoughts',
    role: 'user',
    profileStatus: 'active',
    profilePictureUrl: 'uploads/profile-pictures/deepduckavatar.png',
  });

  console.log('Creating example quacks');

  // Create 3 example posts on software productivity at Applifting
  await createQuack(prisma, {
    text: `just spilled coffee on my keyboard
now every time i type "duck" it autocorrects to "quack"
send help or more caffeine`,
    userId: user1.id,
  });

  await createQuack(prisma, {
    text: `If ducks wore pants, would they wear them on their legs or over their whole lower half like a cape?
Asking for a friend. A feathery friend.`,
    userId: user2.id,
  });

  await createQuack(prisma, {
    text: `me: throws one crumb into the pond
ducks: assemble like the Avengers
i fear i may have started something`,
    userId: user1.id,
  });
};
