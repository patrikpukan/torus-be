import { PrismaClient, UserRole } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function generateRandomCode(length: number = 6): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

    // Initialize Supabase client with service role key for admin operations
    const supabaseStorage = createClient(supabaseUrl, supabaseServiceRoleKey, {
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

async function createDemoUser(
  prisma: PrismaClient,
  userKey: string,
  orgId: string
): Promise<void> {
  try {
    const profile = USER_PROFILES[userKey as keyof typeof USER_PROFILES];
    if (!profile) {
      console.warn(`⚠️  Profile not found for key: ${userKey}`);
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: profile.email },
    });

    if (existingUser) {
      console.log(`⚠️  User already exists: ${profile.email}, skipping`);
      return;
    }

    // Generate UUID for userId
    const userId = randomUUID();

    // Upload avatar
    const avatarUrl = await uploadAvatarToSupabase(
      profile.avatarFileName,
      userId
    );

    // Create user in Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: profile.email,
        password: profile.password,
        email_confirm: true,
        user_metadata: {
          role: profile.role,
          organizationId: orgId,
        },
      });

    if (authError) {
      console.error(
        `❌ Failed to create Supabase user ${profile.email}:`,
        authError
      );
      return;
    }

    if (!authData.user) {
      console.error(`❌ No Supabase user returned for ${profile.email}`);
      return;
    }

    // Create user in database
    const user = await prisma.user.create({
      data: {
        id: authData.user.id, // Use Supabase auth user ID
        supabaseUserId: authData.user.id,
        email: profile.email,
        emailVerified: true,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: profile.role,
        organizationId: orgId,
        about: profile.about,
        hobbies: profile.hobbies,
        preferredActivity: profile.preferredActivity,
        interests: profile.interests,
        image: avatarUrl || undefined,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(
      `✅ Created user: ${profile.firstName} ${profile.lastName} (${profile.role})`
    );
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error creating demo user (${userKey}):`, err);
  }
}

async function createDemoOrganization(prisma: PrismaClient): Promise<string> {
  try {
    // Check if organization already exists
    const existingOrg = await prisma.organization.findFirst({
      where: { code: "TORUS" },
    });

    if (existingOrg) {
      console.log(
        `⚠️  Organization 'Torus Technologies Inc' already exists (ID: ${existingOrg.id})`
      );
      return existingOrg.id;
    }

    // Generate random code
    const code = generateRandomCode(6);

    // Create new organization
    const org = await prisma.organization.create({
      data: {
        name: "Torus Technologies Inc",
        code,
        address:
          "1250 Innovation Way, Tech District, San Francisco, CA 94105",
        size: 150, // Int field, representing number of employees
      },
    });

    console.log(
      `✅ Created organization: Torus Technologies Inc (ID: ${org.id})`
    );
    return org.id;
  } catch (error) {
    console.error("Error creating demo organization:", error);
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

async function main(): Promise<void> {
  console.log("🚀 Starting test data seeding for Torus...\n");

  // Check required environment variables
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing required environment variables:\n" +
        "  - SUPABASE_URL\n" +
        "  - SUPABASE_SERVICE_ROLE_KEY\n\n" +
        "Please set these in your .env file."
    );
  }

  const prisma = new PrismaClient();

  try {
    // Connect to Prisma
    await prisma.$connect();
    console.log("📦 Connected to database\n");

    // Create or get demo organization
    const orgId = await createDemoOrganization(prisma);
    console.log();

    // Create super admin
    await createDemoUser(prisma, "super_admin", orgId);

    // Create org admin
    await createDemoUser(prisma, "org_admin", orgId);

    // Create regular users (user1 through user9)
    for (let i = 1; i <= 9; i++) {
      await createDemoUser(prisma, `user${i}`, orgId);
    }

    console.log();

    // Get user count for summary
    const userCount = await prisma.user.count({
      where: { organizationId: orgId },
    });

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    // Log summary
    console.log("==========================================");
    console.log("✅ Seeding completed successfully!");
    console.log("==========================================\n");
    console.log("📊 Summary:");
    console.log(`   Organization: ${org?.name} (ID: ${org?.id})`);
    console.log(`   Organization Code: ${org?.code}`);
    console.log(`   Total Users Created: ${userCount}\n`);
    console.log("🔐 Login Instructions:");
    console.log("   Super Admin:");
    console.log("   - Email: superadmin@torus.com");
    console.log("   - Password: Password123!\n");
    console.log("   Org Admin:");
    console.log("   - Email: orgadmin@torus.com");
    console.log("   - Password: Password123!\n");
    console.log("   Regular Users:");
    console.log("   - Email: james.wilson@torus.com (and others)");
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

