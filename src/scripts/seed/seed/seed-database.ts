import { randomUUID } from "crypto";
import { PrismaService } from "../../../core/prisma/prisma.service";
import { Config } from "../../../shared/config/config.service";
import { createUser } from "./create-user";

export const seedDatabase = async (
  prisma: PrismaService,
  config: Config
): Promise<void> => {
  const db = prisma as any;

  // Drop existing database data from all tables
  try {
    // Delete data using Prisma's deleteMany (respects foreign keys automatically)
    console.log("Deleting existing data...");
    await db.session.deleteMany({});
    await db.account.deleteMany({});
    await db.verification.deleteMany({});
    await db.orgAdmin.deleteMany({});
    await db.user.deleteMany({});
    await db.organization.deleteMany({});
    console.log("All existing data deleted successfully.");
  } catch (error) {
    console.error("Error deleting data:", error);
    throw error; // Re-throw to stop seeding if cleanup fails
  }

  // Create default organization
  const defaultOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Default Organization",
      code: "DEFAULT",
    },
  });

  console.log("Creating superadmin user");

  // Debug: Check what values we have
  console.log("Debug - config.superadminEmail:", config.superadminEmail);
  console.log(
    "Debug - process.env.SUPERADMIN_EMAIL:",
    process.env.SUPERADMIN_EMAIL
  );
  console.log(
    "Debug - config.superadminPassword:",
    config.superadminPassword ? "[HIDDEN]" : undefined
  );
  console.log(
    "Debug - process.env.SUPERADMIN_PASSWORD:",
    process.env.SUPERADMIN_PASSWORD ? "[HIDDEN]" : undefined
  );

  const email =
    config.superadminEmail ||
    process.env.SUPERADMIN_EMAIL ||
    "admin@example.com";
  const password =
    config.superadminPassword ||
    process.env.SUPERADMIN_PASSWORD ||
    "adminpassword";

  console.log("Debug - Using email:", email);
  console.log("Debug - Using password:", password ? "[HIDDEN]" : undefined);

  // Create a superadmin user. This should be delete in prod app
  await createUser(prisma, {
    email,
    password,
    firstName: "Admin",
    lastName: "(Delete in Prod)",
    username: "superadmin",
    role: "super_admin",
    profileStatus: "active",
    profilePictureUrl: "uploads/profile-pictures/superadminavatar.png",
    organizationId: defaultOrg.id,
  });

  console.log("Creating example users");

  const orgAdminEmail = "caffeinatedduck@example.com";

  await db.orgAdmin.create({
    data: {
      id: randomUUID(),
      email: orgAdminEmail.toLowerCase(),
    },
  });

  const user1 = await createUser(prisma, {
    email: orgAdminEmail,
    password: "password1",
    firstName: "Caffeinated",
    lastName: "Duck",
    username: "CaffeinatedDuck",
    role: "org_admin",
    profileStatus: "active",
    profilePictureUrl: "uploads/profile-pictures/caffeduckavatar.png",
    organizationId: defaultOrg.id,
  });

  const user2 = await createUser(prisma, {
    email: "deepduckthoughts@example.com",
    password: "password2",
    firstName: "Deep",
    lastName: "Duck Thoughts",
    username: "DeepDuckThoughts",
    role: "user",
    profileStatus: "active",
    profilePictureUrl: "uploads/profile-pictures/deepduckavatar.png",
    organizationId: defaultOrg.id,
  });
};
