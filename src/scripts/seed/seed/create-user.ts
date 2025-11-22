import { User, UserRole } from "@prisma/client";
import { PrismaService } from "../../../core/prisma/prisma.service";

type CreateUserParams = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  profilePictureUrl?: string;
  profileStatus?: string;
  organizationId?: string;
  departmentId?: string | null;
};

export async function createUser(
  prisma: PrismaService,
  params: CreateUserParams
): Promise<User> {
  const {
    email,
    firstName,
    lastName,
    role,
    profilePictureUrl,
    profileStatus,
    organizationId,
    departmentId,
  } = params;
  const db = prisma as any;

  // Create or update the user directly via Prisma.
  const { randomUUID } = require("crypto");
  const now = new Date();

  let user = await db.user.findFirst({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: {
        id: randomUUID(),
        email,
        firstName,
        lastName,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        organizationId: organizationId || randomUUID(),
      },
    });
  }

  // Always update role/image if provided
  user = await db.user.update({
    where: { id: user.id },
    data: {
      role: (role as UserRole) ?? undefined,
      image: profilePictureUrl ?? undefined,
      profileStatus: profileStatus ?? "active",
      departmentId: departmentId ?? undefined,
      updatedAt: now,
    },
  });

  return user as User;
}
