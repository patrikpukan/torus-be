import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BetterAuth } from '../../../shared/auth/providers/better-auth.provider';

type CreateUserParams = {
  email: string;
  password: string;
  name: string;
  username: string;
  role?: string;
  profilePictureUrl?: string;
  profileStatus?: string;
};

export async function createUser(
  prisma: PrismaService,
  auth: BetterAuth,
  params: CreateUserParams,
): Promise<User> {
  const { email, password, name, username, role, profilePictureUrl, profileStatus } = params;
  const db = prisma as any;

  // NOTE: Do NOT call BetterAuth here. During seeding we avoid email flows/templates.
  // Create or update the user directly via Prisma.
  const bcrypt = require('bcryptjs');
  const { randomUUID } = require('crypto');
  const now = new Date();

  let user = await db.user.findFirst({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: {
        id: randomUUID(),
        email,
        name,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  // Always update username/role/image if provided
  user = await db.user.update({
    where: { id: user.id },
    data: {
      username,
      role: (role as UserRole) ?? undefined,
      image: profilePictureUrl ?? undefined,
      profileStatus: profileStatus ?? 'active',
      updatedAt: now,
    },
  });

  // Ensure there is an email/password account linked
  const existingAccount = await db.account.findFirst({
    where: { userId: user.id, providerId: 'email' },
  });
  const hashedPassword = await bcrypt.hash(password, 10);
  if (existingAccount) {
    await db.account.update({
      where: { id: existingAccount.id },
      data: { password: hashedPassword, updatedAt: now },
    });
  } else {
    await db.account.create({
      data: {
        id: randomUUID(),
        accountId: `${email}-email`,
        providerId: 'email',
        userId: user.id,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return user as User;
}
