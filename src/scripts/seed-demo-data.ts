import { PrismaClient, UserRole } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

// Load environment variables
dotenv.config();

/**
 * TypeScript type for user profile configuration
 */
type UserProfile = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
  role: "super_admin" | "org_admin" | "user";
  about: string;
  hobbies: string;
  preferredActivity: string;
  interests: string;
  avatarFileName: string;
};

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Generates a random uppercase alphabetic code of specified length
 * @param length - Length of code to generate (default: 6)
 * @returns Random uppercase code
 */
function generateRandomCode(length: number = 6): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Organization configurations
 */
interface OrgConfig {
  name: string;
  code: string;
  address: string;
}

const ORGANIZATIONS: OrgConfig[] = [
  {
    name: "Torus Technologies Inc",
    code: "TORUS",
    address: "1250 Innovation Way, Tech District, San Francisco, CA 94105",
  },
  {
    name: "StartupHub Ventures",
    code: "SHUB",
    address: "456 Market Street, Innovation Quarter, San Francisco, CA 94102",
  },
  {
    name: "Digital Minds Collective",
    code: "DMIN",
    address: "789 Mission Street, Creative Hub, San Francisco, CA 94103",
  },
  {
    name: "Future Labs Network",
    code: "FLAB",
    address: "321 Valencia Street, Tech Hub, San Francisco, CA 94103",
  },
  {
    name: "Innovate Together Co",
    code: "ITCO",
    address: "654 Howard Street, Business District, San Francisco, CA 94105",
  },
];

/**
 * Uploads a profile picture avatar to Supabase Storage
 * @param avatarFileName - Name of the avatar file in uploads/profile-pictures directory
 * @param userId - ID of the user who owns the avatar
 * @returns Public URL of uploaded avatar or null if upload fails
 */
async function uploadAvatarToSupabase(
  avatarFileName: string,
  userId: string
): Promise<string | null> {
  try {
    // Construct avatar path
    const avatarPath = path.join(
      process.cwd(),
      "uploads",
      "profile-pictures",
      avatarFileName
    );

    // Check if file exists
    if (!fs.existsSync(avatarPath)) {
      console.log(
        `⚠️  Avatar not found: ${avatarFileName}, skipping upload`
      );
      return null;
    }

    // Read file
    const fileBuffer = fs.readFileSync(avatarPath);
    const fileExtension = path.extname(avatarFileName).slice(1) || "jpg";

    // Initialize Supabase client with secret key for admin operations
    const supabaseStorage = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Upload to Supabase Storage
    const remotePath = `avatars/${userId}.${fileExtension}`;
    const { data, error } = await supabaseStorage.storage
      .from("avatars")
      .upload(remotePath, fileBuffer, {
        contentType: `image/${fileExtension === "jpg" ? "jpeg" : fileExtension}`,
        upsert: true,
      });

    if (error) {
      console.warn(`⚠️  Failed to upload avatar ${avatarFileName}:`, error.message);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabaseStorage.storage
      .from("avatars")
      .getPublicUrl(remotePath);

    console.log(`  ✓ Uploaded avatar: ${avatarFileName}`);
    return publicUrlData.publicUrl;
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.warn(
      `⚠️  Error uploading avatar ${avatarFileName}: ${err}`
    );
    return null;
  }
}

/**
 * Creates a demo user in both Supabase Auth and the database
 * Includes avatar upload and profile information
 * @param prisma - Prisma client instance
 * @param userKey - Key to look up user profile from USER_PROFILES
 * @param orgId - Organization ID to assign the user to
 * @param emailOverride - Optional email to use instead of profile email
 */
async function createDemoUser(
  prisma: PrismaClient,
  userKey: string,
  orgId: string,
  emailOverride?: string
): Promise<void> {
  try {
    const profile = USER_PROFILES[userKey as keyof typeof USER_PROFILES];
    if (!profile) {
      console.warn(`⚠️  Profile not found for key: ${userKey}`);
      return;
    }

    // Use override email if provided, otherwise use profile email
    const email = emailOverride || profile.email;

    // Generate UUID for userId
    const userId = randomUUID();

    // Upload avatar
    const avatarUrl = await uploadAvatarToSupabase(
      profile.avatarFileName,
      userId
    );

    // Check if user already exists in database by email
    const existingDbUser = await prisma.user.findFirst({
      where: { email },
    });

    if (existingDbUser) {
      // Update existing user with all profile data
      await prisma.user.update({
        where: { id: existingDbUser.id },
        data: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          about: profile.about,
          hobbies: profile.hobbies,
          preferredActivity: profile.preferredActivity,
          interests: profile.interests,
          profileImageUrl: avatarUrl || undefined,
          role: profile.role,
          organizationId: orgId,
          updatedAt: new Date(),
        },
      });
      console.log(
        `✅ Updated user: ${profile.firstName} ${profile.lastName} (${profile.role}) - ${email}`
      );
      return;
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: profile.password,
        email_confirm: true,
        user_metadata: {
          role: profile.role,
          organizationId: orgId,
        },
      });

    if (authError) {
      // Check if user already exists in Supabase Auth
      if (authError.message?.includes("already exists")) {
        console.log(`⚠️  Supabase user already exists: ${email}`);

        // Try to get the existing user
        const { data, error: listError } =
          await supabaseAdmin.auth.admin.listUsers();
        if (!listError && data?.users) {
          const existingAuthUser = data.users.find((u) => u.email === email);
          if (existingAuthUser) {
            // Check if database user exists by Supabase user ID
            const dbUserByAuth = await prisma.user.findUnique({
              where: { id: existingAuthUser.id },
            });
            if (!dbUserByAuth) {
              // Database user doesn't exist, create it with the existing Auth user ID
              await prisma.user.create({
                data: {
                  id: existingAuthUser.id,
                  supabaseUserId: existingAuthUser.id,
                  email,
                  emailVerified: true,
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  role: profile.role,
                  organizationId: orgId,
                  about: profile.about,
                  hobbies: profile.hobbies,
                  preferredActivity: profile.preferredActivity,
                  interests: profile.interests,
                  profileImageUrl: avatarUrl || undefined,
                  isActive: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
              console.log(
                `✅ Created database user: ${profile.firstName} ${profile.lastName} (${profile.role})`
              );
            } else {
              // Update existing database user
              await prisma.user.update({
                where: { id: existingAuthUser.id },
                data: {
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  about: profile.about,
                  hobbies: profile.hobbies,
                  preferredActivity: profile.preferredActivity,
                  interests: profile.interests,
                  profileImageUrl: avatarUrl || undefined,
                  role: profile.role,
                  organizationId: orgId,
                  updatedAt: new Date(),
                },
              });
              console.log(
                `✅ Updated database user: ${profile.firstName} ${profile.lastName} (${profile.role})`
              );
            }
          }
        }
      } else {
        console.error(`❌ Failed to create Supabase user ${email}:`, authError);
      }
      return;
    }

    if (!authData.user) {
      console.error(`❌ No Supabase user returned for ${email}`);
      return;
    }

    // Create user in database with Supabase user ID
    await prisma.user.create({
      data: {
        id: authData.user.id, // Use Supabase auth user ID
        supabaseUserId: authData.user.id,
        email,
        emailVerified: true,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: profile.role,
        organizationId: orgId,
        about: profile.about,
        hobbies: profile.hobbies,
        preferredActivity: profile.preferredActivity,
        interests: profile.interests,
        profileImageUrl: avatarUrl || undefined,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(
      `✅ Created user: ${profile.firstName} ${profile.lastName} (${profile.role}) - ${email}`
    );
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error creating demo user (${userKey}): ${err}`);
  }
}

/**
 * Creates a demo organization or retrieves existing one if already present
 * @param prisma - Prisma client instance
 * @param orgConfig - Organization configuration
 * @returns Organization ID
 */
async function createDemoOrganization(
  prisma: PrismaClient,
  orgConfig: OrgConfig
): Promise<string> {
  try {
    // Check if organization already exists by code
    const existingOrg = await prisma.organization.findFirst({
      where: { code: orgConfig.code },
    });

    if (existingOrg) {
      console.log(
        `⚠️  Organization '${orgConfig.name}' already exists (ID: ${existingOrg.id})`
      );
      return existingOrg.id;
    }

    // Create new organization
    const org = await prisma.organization.create({
      data: {
        name: orgConfig.name,
        code: orgConfig.code,
        address: orgConfig.address,
        size: 150, // Int field, representing number of employees
      },
    });

    console.log(`✅ Created organization: ${orgConfig.name} (ID: ${org.id})`);
    return org.id;
  } catch (error) {
    console.error(
      `Error creating demo organization '${orgConfig.name}':`,
      error
    );
    throw error;
  }
}

const USER_PROFILES = {
  super_admin: {
    email: "superadmin@torus.com",
    password: "Password123!",
    firstName: "Alex",
    lastName: "Morrison",
    username: "alex_morrison",
    role: "super_admin" as UserRole,
    about:
      "Passionate about building communities and fostering meaningful connections. I believe in the power of regular social interactions to create lasting friendships.",
    hobbies: "Photography, Hiking, Reading sci-fi novels, Cooking",
    preferredActivity: "Coffee meetups and outdoor activities",
    interests:
      "Technology, Community building, Outdoor adventures, Philosophy",
    avatarFileName: "super_admin.jpg",
  },
  org_admin: {
    email: "orgadmin@torus.com",
    password: "Password123!",
    firstName: "Marcus",
    lastName: "Chen",
    username: "marcus_chen",
    role: "org_admin" as UserRole,
    about:
      "Tech enthusiast and community organizer. I love bringing people together and making sure everyone feels included.",
    hobbies: "Board games, Basketball, Podcasting, Travel",
    preferredActivity: "Group activities and sports",
    interests: "Sports, Gaming, Technology, Team building",
    avatarFileName: "org_admin.jpg",
  },
  user1: {
    email: "james.wilson@torus.com",
    password: "Password123!",
    firstName: "James",
    lastName: "Wilson",
    username: "james_wilson",
    role: "user" as UserRole,
    about:
      "Software engineer who loves exploring new restaurants and trying different cuisines. Always up for a good conversation over coffee.",
    hobbies: "Cooking, Running, Guitar, Wine tasting",
    preferredActivity: "Dining out and coffee chats",
    interests: "Food & Dining, Music, Fitness, Technology",
    avatarFileName: "user1.jpg",
  },
  user2: {
    email: "david.nguyen@torus.com",
    password: "Password123!",
    firstName: "David",
    lastName: "Nguyen",
    username: "david_nguyen",
    role: "user" as UserRole,
    about:
      "Designer and creative thinker. I enjoy discussing design philosophy and exploring innovative ideas with like-minded people.",
    hobbies: "Digital art, Skateboarding, Coffee roasting, Anime",
    preferredActivity: "Creative workshops and design talks",
    interests: "Design, Art, Technology, Coffee culture",
    avatarFileName: "user2.jpg",
  },
  user3: {
    email: "robert.smith@torus.com",
    password: "Password123!",
    firstName: "Robert",
    lastName: "Smith",
    username: "robert_smith",
    role: "user" as UserRole,
    about:
      "Finance professional who loves outdoor activities. I believe in work-life balance and making time for meaningful relationships.",
    hobbies: "Rock climbing, Fishing, Chess, Investing",
    preferredActivity: "Outdoor adventures and strategy games",
    interests: "Finance, Fitness, Nature, Strategy games",
    avatarFileName: "user3.jpg",
  },
  user4: {
    email: "michael.garcia@torus.com",
    password: "Password123!",
    firstName: "Michael",
    lastName: "Garcia",
    username: "michael_garcia",
    role: "user" as UserRole,
    about:
      "Marketing specialist and event organizer. I love meeting new people and creating memorable experiences together.",
    hobbies: "Salsa dancing, Event planning, Photography, Travel",
    preferredActivity: "Social events and networking",
    interests: "Marketing, Events, Travel, Music",
    avatarFileName: "user4.jpg",
  },
  user5: {
    email: "christopher.lee@torus.com",
    password: "Password123!",
    firstName: "Christopher",
    lastName: "Lee",
    username: "christopher_lee",
    role: "user" as UserRole,
    about:
      "Data scientist who is passionate about machine learning and problem-solving. I enjoy technical discussions and intellectual challenges.",
    hobbies: "Machine learning, Reading, Simulation games, Coding",
    preferredActivity: "Tech discussions and hackathons",
    interests: "Technology, Science, Gaming, Mathematics",
    avatarFileName: "user5.jpg",
  },
  user6: {
    email: "kevin.martinez@torus.com",
    password: "Password123!",
    firstName: "Kevin",
    lastName: "Martinez",
    username: "kevin_martinez",
    role: "user" as UserRole,
    about:
      "Healthcare professional with a passion for wellness. I'm interested in discussing health trends and maintaining active lifestyle.",
    hobbies: "Yoga, Trail running, Meal prep, Meditation",
    preferredActivity: "Fitness activities and wellness meetups",
    interests: "Health & Wellness, Fitness, Nutrition, Mindfulness",
    avatarFileName: "user6.jpg",
  },
  user7: {
    email: "andrew.johnson@torus.com",
    password: "Password123!",
    firstName: "Andrew",
    lastName: "Johnson",
    username: "andrew_johnson",
    role: "user" as UserRole,
    about:
      "Creative writer and storyteller. I love exploring narratives, discussing literature, and collaborating on creative projects.",
    hobbies: "Writing, Theater, Book club, Podcasting",
    preferredActivity: "Literary discussions and creative collaborations",
    interests: "Literature, Writing, Theater, Storytelling",
    avatarFileName: "user7.jpg",
  },
  user8: {
    email: "daniel.taylor@torus.com",
    password: "Password123!",
    firstName: "Daniel",
    lastName: "Taylor",
    username: "daniel_taylor",
    role: "user" as UserRole,
    about:
      "Musician and audio engineer. I believe in the power of music to connect people and create meaningful moments.",
    hobbies: "Music production, Vinyl collecting, DJing, Concert attending",
    preferredActivity: "Music jams and concert outings",
    interests: "Music, Audio technology, Entertainment, Live events",
    avatarFileName: "user8.jpg",
  },
  user9: {
    email: "brandon.anderson@torus.com",
    password: "Password123!",
    firstName: "Brandon",
    lastName: "Anderson",
    username: "brandon_anderson",
    role: "user" as UserRole,
    about:
      "Entrepreneur and startup enthusiast. I'm passionate about innovation, business strategy, and mentoring young professionals.",
    hobbies: "Business reading, Networking, Mentoring, Volleyball",
    preferredActivity: "Business meetups and mentoring sessions",
    interests: "Business, Entrepreneurship, Innovation, Leadership",
    avatarFileName: "user9.jpg",
  },
};

/**
 * Main orchestrator function for seeding demo data
 * Creates organization, super_admin, org_admin, and 9 regular users
 * Uploads avatar images to Supabase Storage and creates database records
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 * @returns void
 * @throws Error if required environment variables are missing or database operations fail
 */
async function main(): Promise<void> {
  console.log("🚀 Starting test data seeding for Torus...\n");

  // Check required environment variables
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Missing required environment variables:\n" +
        "  - SUPABASE_URL\n" +
        "  - SUPABASE_SECRET_KEY\n\n" +
        "Please set these in your .env file."
    );
  }

  const prisma = new PrismaClient();

  try {
    // Connect to Prisma
    await prisma.$connect();
    console.log("📦 Connected to database\n");

    // Create 5 organizations
    const organizationIds: string[] = [];
    for (const orgConfig of ORGANIZATIONS) {
      const orgId = await createDemoOrganization(prisma, orgConfig);
      organizationIds.push(orgId);
    }
    console.log();

    // Create all users (11 per organization) = 55 total users
    const userKeys = ["super_admin", "org_admin", ...Array.from({ length: 9 }, (_, i) => `user${i + 1}`)];

    for (let orgIndex = 0; orgIndex < organizationIds.length; orgIndex++) {
      const orgId = organizationIds[orgIndex];
      const orgConfig = ORGANIZATIONS[orgIndex];

      console.log(`\n📍 Creating users for ${orgConfig.name}...`);
      for (const userKey of userKeys) {
        // Generate org-specific email: e.g., super_admin_torus@torus.com
        const emailPrefix = userKey.replace(/_/g, `_${orgConfig.code.toLowerCase()}_`);
        const email = `${emailPrefix}@torus.com`;
        await createDemoUser(prisma, userKey, orgId, email);
      }
    }

    console.log();

    // Get summary stats
    const totalOrgCount = await prisma.organization.count();
    const totalUserCount = await prisma.user.count();
    const organizations = await prisma.organization.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    // Log summary
    console.log("==========================================");
    console.log("✅ Seeding completed successfully!");
    console.log("==========================================\n");
    console.log("📊 Summary:");
    console.log(`   Total Organizations: ${totalOrgCount}`);
    console.log(`   Total Users Created: ${totalUserCount}\n`);
    console.log("🏢 Organizations:");
    for (const org of organizations) {
      console.log(
        `   - ${org.name} (${org.code}): ${org._count.users} users`
      );
    }
    console.log("\n🔐 Sample Login Instructions:");
    console.log("   Organization: Torus Technologies Inc (TORUS)");
    console.log("   - Email: super_admin_torus@torus.com");
    console.log("   - Password: Password123!\n");
    console.log("   Organization: StartupHub Ventures (SHUB)");
    console.log("   - Email: super_admin_shub@torus.com");
    console.log("   - Password: Password123!\n");
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error("❌ Error during seeding:", err);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log("🔌 Database connection closed.");
  }
}

// Run the seed
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

