import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || "";

/**
 * Prompt user for confirmation before cleanup
 */
async function confirmCleanup(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("⚠️  WARNING: This will delete DEMO DATA ONLY:");
    console.log("   - Organizations: TORUS, SHUB, DMIN");
    console.log("   - All users with @torus.com emails");
    console.log(
      "   - All pairings, periods, calendar events for demo orgs"
    );
    console.log(
      "   - All related data (messages, reports, meeting events)"
    );
    console.log();
    console.log("✅ Production data will be PRESERVED");
    console.log();

    rl.question("Are you sure you want to proceed? (yes/no): ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Clean up Supabase Auth users for demo accounts
 */
async function cleanupSupabaseAuthUsers(
  demoUserEmails: string[]
): Promise<void> {
  console.log("\n🔐 Cleaning up Supabase Auth users...");

  if (!supabaseUrl || !supabaseSecretKey) {
    console.log(
      "  ⚠️  Supabase credentials not found, skipping auth cleanup"
    );
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Get all users from Supabase Auth
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    console.log(`  ⚠️  Error listing Supabase users: ${error.message}`);
    return;
  }

  if (!data?.users) {
    console.log("  ⚠️  No users found in Supabase Auth");
    return;
  }

  // Filter for demo users (by email pattern)
  const demoAuthUsers = data.users.filter(
    (user) => user.email && demoUserEmails.includes(user.email)
  );

  console.log(`  Found ${demoAuthUsers.length} demo users in Supabase Auth`);

  // Delete each demo user
  let deletedCount = 0;
  for (const user of demoAuthUsers) {
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) {
      console.log(
        `  ⚠️  Failed to delete ${user.email}: ${deleteError.message}`
      );
    } else {
      deletedCount++;
    }
  }

  console.log(`  ✓ Deleted ${deletedCount} users from Supabase Auth`);
}

/**
 * Clean up avatars from Supabase Storage
 */
async function cleanupSupabaseAvatars(userIds: string[]): Promise<void> {
  console.log("\n🖼️  Cleaning up Supabase Storage avatars...");

  if (!supabaseUrl || !supabaseSecretKey) {
    console.log(
      "  ⚠️  Supabase credentials not found, skipping avatar cleanup"
    );
    return;
  }

  const supabaseStorage = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // List all files in profile-pictures bucket
  const { data: files, error: listError } = await supabaseStorage.storage
    .from("profile-pictures")
    .list();

  if (listError) {
    console.log(`  ⚠️  Error listing avatars: ${listError.message}`);
    return;
  }

  if (!files || files.length === 0) {
    console.log("  ℹ️  No avatars found in storage");
    return;
  }

  // Filter for demo user avatars
  const demoAvatars = files.filter((file) => {
    // Extract userId from filename (e.g., "userId.jpg")
    const userId = file.name.split(".")[0];
    return userIds.includes(userId);
  });

  console.log(`  Found ${demoAvatars.length} demo avatars in storage`);

  // Delete each avatar
  let deletedCount = 0;
  for (const file of demoAvatars) {
    const { error: deleteError } = await supabaseStorage.storage
      .from("profile-pictures")
      .remove([file.name]);

    if (deleteError) {
      console.log(
        `  ⚠️  Failed to delete ${file.name}: ${deleteError.message}`
      );
    } else {
      deletedCount++;
    }
  }

  console.log(`  ✓ Deleted ${deletedCount} avatars from storage`);
}

/**
 * Main cleanup function - deletes ONLY demo data
 */
async function cleanupDemoDataOnly(prisma: PrismaClient): Promise<void> {
  console.log("🧹 Starting demo data cleanup...\n");

  // Step 1: Identify demo organizations
  const demoCodes = ["TORUS", "SHUB", "DMIN"];

  const demoOrgs = await prisma.organization.findMany({
    where: {
      code: { in: demoCodes },
    },
    select: { id: true, name: true, code: true },
  });

  if (demoOrgs.length === 0) {
    console.log(
      "⚠️  No demo organizations found. Nothing to clean up."
    );
    return;
  }

  console.log(`📋 Found ${demoOrgs.length} demo organizations:`);
  demoOrgs.forEach((org) => console.log(`   - ${org.name} (${org.code})`));
  console.log();

  const demoOrgIds = demoOrgs.map((o) => o.id);

  // Step 2: Get demo user info BEFORE deletion (for Supabase cleanup)
  const demoUsers = await prisma.user.findMany({
    where: {
      organizationId: { in: demoOrgIds },
    },
    select: { id: true, email: true },
  });

  const demoUserEmails = demoUsers.map((u) => u.email);
  const demoUserIds = demoUsers.map((u) => u.id);

  console.log(`👥 Found ${demoUsers.length} demo users\n`);

  // Step 3: Delete database records (in correct order)

  console.log("🗑️  Deleting database records...\n");

  // 3a. Delete MeetingEvents (depends on Pairing)
  console.log("📆 Deleting meeting events...");
  const deletedMeetings = await prisma.meetingEvent.deleteMany({
    where: {
      pairing: {
        organizationId: { in: demoOrgIds },
      },
    },
  });
  console.log(`   ✓ Deleted ${deletedMeetings.count} meeting events`);

  // 3b. Delete Messages (depends on Pairing)
  console.log("💬 Deleting messages...");
  const deletedMessages = await prisma.message.deleteMany({
    where: {
      pairing: {
        organizationId: { in: demoOrgIds },
      },
    },
  });
  console.log(`   ✓ Deleted ${deletedMessages.count} messages`);

  // 3c. Delete Reports (depends on Pairing)
  console.log("📋 Deleting reports...");
  const deletedReports = await prisma.report.deleteMany({
    where: {
      pairing: {
        organizationId: { in: demoOrgIds },
      },
    },
  });
  console.log(`   ✓ Deleted ${deletedReports.count} reports`);

  // 3d. Delete Pairings (must delete before PairingPeriods)
  console.log("🤝 Deleting pairings...");
  const deletedPairings = await prisma.pairing.deleteMany({
    where: {
      period: {
        organizationId: { in: demoOrgIds },
      },
    },
  });
  console.log(`   ✓ Deleted ${deletedPairings.count} pairings`);

  // 3e. Delete PairingPeriods (must delete after Pairings due to foreign key)
  console.log("🗓️  Deleting pairing periods...");
  const deletedPeriods = await prisma.pairingPeriod.deleteMany({
    where: {
      organizationId: { in: demoOrgIds },
    },
  });
  console.log(`   ✓ Deleted ${deletedPeriods.count} pairing periods`);

  // 3f. Delete CalendarEvents
  console.log("📅 Deleting calendar events...");
  const deletedEvents = await prisma.calendarEvent.deleteMany({
    where: {
      user: {
        organizationId: { in: demoOrgIds },
      },
    },
  });
  console.log(`   ✓ Deleted ${deletedEvents.count} calendar events`);

  // 3g. Delete InviteCodes
  console.log("🎫 Deleting invite codes...");
  const deletedInvites = await prisma.inviteCode.deleteMany({
    where: {
      organizationId: { in: demoOrgIds },
    },
  });
  console.log(`   ✓ Deleted ${deletedInvites.count} invite codes`);

  // 3h. Delete Bans (must delete before Users)
  console.log("🚫 Deleting user bans...");
  const deletedBans = await prisma.ban.deleteMany({
    where: {
      organizationId: { in: demoOrgIds },
    },
  });
  console.log(`   ✓ Deleted ${deletedBans.count} user bans`);

  // 3i. Delete Users
  console.log("👥 Deleting users...");
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      organizationId: { in: demoOrgIds },
    },
  });
  console.log(`   ✓ Deleted ${deletedUsers.count} users from database`);

  // 3j. Delete Organizations
  console.log("🏢 Deleting organizations...");
  const deletedOrgs = await prisma.organization.deleteMany({
    where: {
      id: { in: demoOrgIds },
    },
  });
  console.log(`   ✓ Deleted ${deletedOrgs.count} organizations`);

  // Step 4: Clean up Supabase Auth users
  await cleanupSupabaseAuthUsers(demoUserEmails);

  // Step 5: Clean up Supabase Storage avatars
  await cleanupSupabaseAvatars(demoUserIds);

  console.log(
    "\n" +
      "=".repeat(50)
  );
  console.log("✅ Demo data cleanup completed successfully!");
  console.log("=".repeat(50));
  console.log("\n📊 Summary:");
  console.log(`   Organizations: ${deletedOrgs.count}`);
  console.log(`   Users: ${deletedUsers.count}`);
  console.log(`   Pairings: ${deletedPairings.count}`);
  console.log(`   Pairing Periods: ${deletedPeriods.count}`);
  console.log(`   Calendar Events: ${deletedEvents.count}`);
  console.log(`   Meeting Events: ${deletedMeetings.count}`);
  console.log(`   Messages: ${deletedMessages.count}`);
  console.log(`   Reports: ${deletedReports.count}`);
  console.log(`   User Bans: ${deletedBans.count}`);
  console.log(`   Invite Codes: ${deletedInvites.count}`);
  console.log("\n✅ Production data preserved!");
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Check for --force flag to skip confirmation
  const forceCleanup = process.argv.includes("--force");

  if (!forceCleanup) {
    const confirmed = await confirmCleanup();

    if (!confirmed) {
      console.log("\n❌ Cleanup cancelled by user");
      process.exit(0);
    }
    console.log(); // Empty line after confirmation
  }

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log("📦 Connected to database\n");

    await cleanupDemoDataOnly(prisma);
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error("❌ Cleanup failed:", err);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log("\n🔌 Database connection closed.");
  }
}

// Run the cleanup
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
