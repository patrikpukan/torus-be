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
 * Adds days to a date
 * @param date - Base date
 * @param days - Number of days to add (can be negative)
 * @returns New date with days added
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Formats a date as short format (e.g., "Jan 14")
 * @param date - Date to format
 * @returns Formatted date string
 */
function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Creates pairing periods for an organization
 * Generates 2 pairing periods of 3 weeks each:
 * - Active period: started 1 week ago, ends 2 weeks from now
 * - Upcoming period: starts 3 weeks from now, ends 6 weeks from now
 * Idempotent: checks if periods already exist before creating
 * @param prisma - Prisma client instance
 * @param orgId - Organization ID
 * @returns Object containing activePeriodId and upcomingPeriodId
 */
async function createPairingPeriodsForOrg(
  prisma: PrismaClient,
  orgId: string
): Promise<{ activePeriodId: string; upcomingPeriodId: string }> {
  try {
    // Check if periods already exist
    const existingActivePeriod = await prisma.pairingPeriod.findFirst({
      where: {
        organizationId: orgId,
        status: "active",
      },
    });

    const existingUpcomingPeriod = await prisma.pairingPeriod.findFirst({
      where: {
        organizationId: orgId,
        status: "upcoming",
      },
    });

    if (existingActivePeriod && existingUpcomingPeriod) {
      console.log(`  ⚠️  Pairing periods already exist, skipping creation...`);
      return {
        activePeriodId: existingActivePeriod.id,
        upcomingPeriodId: existingUpcomingPeriod.id,
      };
    }

    const today = new Date();

    // Create active period if it doesn't exist
    let activePeriod = existingActivePeriod;
    if (!activePeriod) {
      const activeStartDate = addDays(today, -7);
      const activeEndDate = addDays(today, 14);

      activePeriod = await prisma.pairingPeriod.create({
        data: {
          organizationId: orgId,
          startDate: activeStartDate,
          endDate: activeEndDate,
          status: "active",
        },
      });
    }

    // Create upcoming period if it doesn't exist
    let upcomingPeriod = existingUpcomingPeriod;
    if (!upcomingPeriod) {
      const upcomingStartDate = addDays(today, 21);
      const upcomingEndDate = addDays(today, 42);

      upcomingPeriod = await prisma.pairingPeriod.create({
        data: {
          organizationId: orgId,
          startDate: upcomingStartDate,
          endDate: upcomingEndDate,
          status: "upcoming",
        },
      });
    }

    if (!existingActivePeriod || !existingUpcomingPeriod) {
      const activeStartDate = addDays(today, -7);
      const activeEndDate = addDays(today, 14);
      const upcomingStartDate = addDays(today, 21);
      const upcomingEndDate = addDays(today, 42);

      console.log(
        `  ✓ Created pairing periods: Active (${formatDateShort(activeStartDate)} - ${formatDateShort(activeEndDate)}), Upcoming (${formatDateShort(upcomingStartDate)} - ${formatDateShort(upcomingEndDate)})`
      );
    }

    return {
      activePeriodId: activePeriod.id,
      upcomingPeriodId: upcomingPeriod.id,
    };
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error creating pairing periods for org ${orgId}:`, err);
    throw error;
  }
}

/**
 * Creates pairings for an active pairing period
 * Simulates what the pairing algorithm would have created by:
 * 1. Filtering eligible users (role: 'user', isActive: true)
 * 2. Shuffling them randomly
 * 3. Pairing sequentially: [0,1], [2,3], etc.
 * 4. Assigning realistic statuses based on 3-week cycle distribution
 * 5. Setting createdAt dates spread throughout the active period
 * Idempotent: skips creation if pairings already exist for this period
 * @param prisma - Prisma client instance
 * @param orgId - Organization ID
 * @param activePeriodId - ID of the active pairing period
 * @param users - All users from the organization
 * @returns Array of created Pairing records
 */
async function createPairingsForOrg(
  prisma: PrismaClient,
  orgId: string,
  activePeriodId: string,
  users: {
    id: string;
    role: string;
    isActive: boolean;
    firstName?: string | null;
    lastName?: string | null;
  }[]
): Promise<
  {
    id: string;
    userAId: string;
    userBId: string;
    status: string;
    createdAt: Date;
  }[]
> {
  try {
    // Check if pairings already exist for this period
    const existingPairings = await prisma.pairing.findMany({
      where: { periodId: activePeriodId },
    });

    if (existingPairings.length > 0) {
      console.log(
        `  ⚠️  ${existingPairings.length} pairings already exist for this period, skipping creation...`
      );
      return existingPairings as {
        id: string;
        userAId: string;
        userBId: string;
        status: string;
        createdAt: Date;
      }[];
    }

    // Get period dates for calculating realistic createdAt values
    const period = await prisma.pairingPeriod.findUnique({
      where: { id: activePeriodId },
      select: { startDate: true, endDate: true },
    });

    if (!period || !period.startDate) {
      throw new Error(`Period ${activePeriodId} not found or missing dates`);
    }

    // Filter eligible users (matching algorithm logic)
    const eligibleUsers = users.filter(
      (user) => user.role === "user" && user.isActive === true
    );

    console.log(
      `  Eligible users for pairing: ${eligibleUsers.length} of ${users.length}`
    );

    // Helper to create dates within period
    function getDateInPeriod(daysFromStart: number): Date {
      const date = new Date(period!.startDate!);
      date.setDate(date.getDate() + daysFromStart);
      return date;
    }

    // Shuffle eligible users (simple random shuffle - Fisher-Yates)
    const shuffled = [...eligibleUsers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const pairings: {
      id: string;
      userAId: string;
      userBId: string;
      status: string;
      createdAt: Date;
    }[] = [];

    // Pair users sequentially: [0,1], [2,3], [4,5], etc.
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const userA = shuffled[i];
      const userB = shuffled[i + 1];

      // Assign status and createdAt based on 3-week cycle distribution
      // Week 1: Algorithm creates pairings (planned)
      // Week 1-2: Users respond (planned → matched or declined)
      // Week 2-3: Matched users meet (matched → met or not_met)
      // Seed data shows mid-cycle realistic distribution
      const rand = Math.random();
      let status: "met" | "matched" | "planned" | "not_met";
      let daysFromStart: number;

      if (rand < 0.3) {
        // 30% "met" - completed successfully (early in cycle, days 1-7)
        status = "met";
        daysFromStart = 1 + Math.floor(Math.random() * 6); // 1-7 days
      } else if (rand < 0.7) {
        // 40% "matched" - accepted, not yet met (mid-cycle, days 3-10)
        status = "matched";
        daysFromStart = 3 + Math.floor(Math.random() * 7); // 3-10 days
      } else if (rand < 0.9) {
        // 20% "planned" - newly created, not yet responded (recent, days 7-13)
        status = "planned";
        daysFromStart = 7 + Math.floor(Math.random() * 6); // 7-13 days
      } else {
        // 10% "not_met" - accepted but didn't happen (early, days 1-7)
        status = "not_met";
        daysFromStart = 1 + Math.floor(Math.random() * 6); // 1-7 days
      }

      const pairing = await prisma.pairing.create({
        data: {
          periodId: activePeriodId,
          organizationId: orgId,
          userAId: userA.id,
          userBId: userB.id,
          status,
          createdAt: getDateInPeriod(daysFromStart),
        },
      });

      pairings.push(pairing);
    }

    // Log results with status distribution
    const statusCounts = pairings.reduce(
      (acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const statusSummary = Object.entries(statusCounts)
      .sort()
      .map(([s, c]) => `${c} ${s}`)
      .join(", ");

    console.log(`  ✓ Created ${pairings.length} pairings (${statusSummary})`);

    if (shuffled.length % 2 === 1) {
      const unpaired = shuffled[shuffled.length - 1];
      console.log(
        `  ⚠️  1 user unpaired: ${unpaired.firstName} ${unpaired.lastName} (odd number of eligible users)`
      );
    }

    return pairings;
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error creating pairings for org ${orgId}:`, err);
    throw error;
  }
}

/**
 * Creates realistic calendar events (availability/unavailability) for a user
 * Simulates user scheduling preferences and busy periods:
 * - 60% availability events (times user IS available for pairing)
 * - 40% unavailability events (vacation, focus time, busy periods)
 * Events are spread across past 2 weeks and next 2 weeks for realistic demo data
 * Idempotent: skips creation if user already has calendar events
 * @param prisma - Prisma client instance
 * @param userId - User ID to create events for
 * @returns Promise<void>
 */
async function createCalendarEventsForUser(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  try {
    // Check if user already has calendar events
    const existingEvents = await prisma.calendarEvent.findMany({
      where: { userId },
    });

    if (existingEvents.length > 0) {
      console.log(
        `    ⚠️  User already has ${existingEvents.length} calendar events, skipping...`
      );
      return;
    }
    // Helper to get a random weekday, moving weekends to Monday
    function getRandomWeekday(daysOffset: number): Date {
      const date = addDays(new Date(), daysOffset);
      const day = date.getDay();
      if (day === 0) date.setDate(date.getDate() + 1); // Sunday -> Monday
      if (day === 6) date.setDate(date.getDate() + 2); // Saturday -> Monday
      return date;
    }

    // Helper to set a specific business hour
    function setBusinessHour(date: Date, hour: number): Date {
      const newDate = new Date(date);
      newDate.setHours(hour, 0, 0, 0);
      return newDate;
    }

    // Create 3-5 calendar events
    const numEvents = 3 + Math.floor(Math.random() * 3);
    let availabilityCount = 0;
    let unavailabilityCount = 0;

    for (let i = 0; i < numEvents; i++) {
      const isAvailability = Math.random() < 0.6;

      // Random date within -14 to +14 days
      const daysOffset = Math.floor(Math.random() * 28) - 14;
      const eventDate = getRandomWeekday(daysOffset);

      if (isAvailability) {
        // Availability: 2-4 hour block during work hours
        const startHour = 9 + Math.floor(Math.random() * 5); // 9 AM - 1 PM
        const duration = 2 + Math.floor(Math.random() * 3); // 2-4 hours
        const titles = [
          "Available for coffee",
          "Open for meetings",
          "Free for chats",
        ];
        const title = titles[Math.floor(Math.random() * titles.length)];

        await prisma.calendarEvent.create({
          data: {
            userId,
            type: "availability",
            title,
            description: "Available for 1:1 connections",
            startDateTime: setBusinessHour(new Date(eventDate), startHour),
            endDateTime: setBusinessHour(
              new Date(eventDate),
              startHour + duration
            ),
            rrule:
              Math.random() < 0.3 ? "FREQ=WEEKLY;BYDAY=MO,WE,FR" : null,
          },
        });
        availabilityCount++;
      } else {
        // Unavailability: various durations
        const startHour = 8 + Math.floor(Math.random() * 8); // 8 AM - 4 PM
        const duration = 1 + Math.floor(Math.random() * 8); // 1-8 hours
        const titles = ["On vacation", "Out of office", "Focus time"];
        const title = titles[Math.floor(Math.random() * titles.length)];

        await prisma.calendarEvent.create({
          data: {
            userId,
            type: "unavailability",
            title,
            description: "Not available for pairings",
            startDateTime: setBusinessHour(new Date(eventDate), startHour),
            endDateTime: setBusinessHour(
              new Date(eventDate),
              startHour + duration
            ),
            rrule: null,
          },
        });
        unavailabilityCount++;
      }
    }

    console.log(
      `    ✓ Created ${numEvents} events (${availabilityCount} availability, ${unavailabilityCount} unavailability)`
    );
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error creating calendar events for user ${userId}:`, err);
    // Don't throw - calendar events are optional for demo
  }
}

/**
 * Creates a meeting event for a completed or scheduled pairing
 * Only creates events for pairings with status "met" or "matched"
 * Simulates realistic meeting scheduling with:
 * - Past meetings (met status): 3-7 days ago, fully confirmed
 * - Upcoming meetings (matched status): 2-5 days from now, one user may be pending
 * Idempotent: skips creation if meeting already exists for pairing
 * @param prisma - Prisma client instance
 * @param pairing - Pairing record to create meeting for
 * @returns Promise<void>
 */
async function createMeetingEventForPairing(
  prisma: PrismaClient,
  pairing: {
    id: string;
    status: string;
    userAId: string;
    userBId: string;
  }
): Promise<void> {
  try {
    // Only create meetings for matched or met pairings
    if (pairing.status !== "matched" && pairing.status !== "met") {
      return;
    }

    // Check if meeting already exists for this pairing
    const existingMeeting = await prisma.meetingEvent.findFirst({
      where: { pairingId: pairing.id },
    });

    if (existingMeeting) {
      console.log(`    ⚠️  Meeting already exists for pairing, skipping...`);
      return;
    }

    const isPast = pairing.status === "met";

    // Helper to get random weekday, moving weekends to Monday
    function getRandomWeekday(daysOffset: number): Date {
      const date = addDays(new Date(), daysOffset);
      const day = date.getDay();
      if (day === 0) date.setDate(date.getDate() + 1); // Sunday -> Monday
      if (day === 6) date.setDate(date.getDate() + 2); // Saturday -> Monday
      return date;
    }

    // Calculate meeting date based on pairing status
    const daysOffset = isPast
      ? -(3 + Math.floor(Math.random() * 5)) // Past: -3 to -7 days
      : 2 + Math.floor(Math.random() * 4); // Future: +2 to +5 days

    const meetingDate = getRandomWeekday(daysOffset);

    // Set random business hour (10am, 11am, 2pm, 3pm are common slots)
    const hours = [10, 11, 14, 15];
    const hour = hours[Math.floor(Math.random() * hours.length)];
    meetingDate.setHours(hour, 0, 0, 0);

    // End time is 1 hour later
    const endDate = new Date(meetingDate);
    endDate.setHours(hour + 1, 0, 0, 0);

    // Confirmation status: past meetings are fully confirmed
    // Future meetings: 60% both confirmed, 40% userB pending
    const userBConfirmed = isPast || Math.random() > 0.4;

    // Notes: past meetings have specific topics, future meetings may have intent
    const topics = ["technology", "hobbies", "career goals", "work projects"];
    const userANote = isPast
      ? `Great conversation about ${topics[Math.floor(Math.random() * topics.length)]}!`
      : Math.random() > 0.5
        ? "Looking forward to this"
        : null;

    // Randomly choose who created the meeting
    const createdByUserId =
      Math.random() > 0.5 ? pairing.userAId : pairing.userBId;

    await prisma.meetingEvent.create({
      data: {
        pairingId: pairing.id,
        userAId: pairing.userAId,
        userBId: pairing.userBId,
        startDateTime: meetingDate,
        endDateTime: endDate,
        userAConfirmationStatus: "confirmed",
        userBConfirmationStatus: userBConfirmed ? "confirmed" : "pending",
        createdByUserId,
        userANote,
      },
    });

    const dateStr = meetingDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const timeStr = meetingDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    console.log(
      `    ✓ Created meeting event (${dateStr} @ ${timeStr}, ${pairing.status})`
    );
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error(
      `❌ Error creating meeting event for pairing ${pairing.id}:`,
      err
    );
    // Don't throw - meeting events are optional for demo
  }
}

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
        `  ⚠️  Avatar not found: ${avatarFileName}, skipping upload`
      );
      return null;
    }

    // Check Supabase credentials
    if (!supabaseUrl || !supabaseSecretKey) {
      console.log(
        `  ⚠️  Supabase credentials not configured, skipping avatar upload`
      );
      return null;
    }

    // Read file
    const fileBuffer = fs.readFileSync(avatarPath);
    const fileExtension = path.extname(avatarFileName).slice(1) || "jpg";
    const fileSize = fileBuffer.length;

    // Initialize Supabase client with secret key for admin operations
    const supabaseStorage = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Upload to Supabase Storage
    const remotePath = `${userId}.${fileExtension}`;
    const { data, error } = await supabaseStorage.storage
      .from("profile-pictures")
      .upload(remotePath, fileBuffer, {
        contentType: `image/${fileExtension === "jpg" ? "jpeg" : fileExtension}`,
        upsert: true,
      });

    if (error) {
      console.warn(
        `  ⚠️  Failed to upload avatar ${avatarFileName} (${fileSize} bytes): ${error.message}`
      );
      return null;
    }

    if (!data) {
      console.warn(
        `  ⚠️  No data returned from avatar upload: ${avatarFileName}`
      );
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabaseStorage.storage
      .from("profile-pictures")
      .getPublicUrl(remotePath);

    if (!publicUrlData?.publicUrl) {
      console.warn(
        `  ⚠️  Failed to get public URL for avatar: ${avatarFileName}`
      );
      return null;
    }

    console.log(`  ✓ Uploaded avatar: ${avatarFileName}`);
    return publicUrlData.publicUrl;
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.warn(
      `  ⚠️  Error uploading avatar ${avatarFileName}: ${err}`
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
): Promise<{
  id: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
} | null> {
  try {
    const profile = USER_PROFILES[userKey as keyof typeof USER_PROFILES];
    if (!profile) {
      console.warn(`⚠️  Profile not found for key: ${userKey}`);
      return null;
    }

    // Use override email if provided, otherwise use profile email
    const email = emailOverride || profile.email;

    // First, get or create the Supabase Auth user to get their actual ID
    // Check if user already exists in Supabase Auth
    const { data: existingAuthData, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    let authUserId: string | null = null;

    if (!listError && existingAuthData?.users) {
      const existingAuthUser = existingAuthData.users.find(
        (u) => u.email === email
      );
      if (existingAuthUser) {
        authUserId = existingAuthUser.id;
      }
    }

    // If auth user doesn't exist, create it
    if (!authUserId) {
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
        console.error(`❌ Failed to create Supabase user ${email}:`, authError);
        return null;
      }

      if (authData?.user) {
        authUserId = authData.user.id;
      } else {
        console.error(`❌ No Supabase user ID returned for ${email}`);
        return null;
      }
    }

    // Now upload avatar using the actual auth user ID
    const avatarUrl = await uploadAvatarToSupabase(
      profile.avatarFileName,
      authUserId
    );

    // Check if user already exists in database by auth ID
    const existingDbUser = await prisma.user.findUnique({
      where: { id: authUserId },
    });

    if (existingDbUser) {
      // Update existing user with all profile data
      await prisma.user.update({
        where: { id: authUserId },
        data: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          about: profile.about,
          hobbies: profile.hobbies,
          preferredActivity: profile.preferredActivity,
          interests: profile.interests,
          profileImageUrl: avatarUrl ?? null,
          role: profile.role,
          organizationId: orgId,
          updatedAt: new Date(),
        },
      });
      console.log(
        `✅ Updated user: ${profile.firstName} ${profile.lastName} (${profile.role}) - ${email}`
      );
      return {
        id: existingDbUser.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: profile.role,
        isActive: existingDbUser.isActive,
      };
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
              const createdUser = await prisma.user.create({
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
                  profileImageUrl: avatarUrl ?? null,
                  isActive: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
              console.log(
                `✅ Created database user: ${profile.firstName} ${profile.lastName} (${profile.role})`
              );
              return {
                id: createdUser.id,
                firstName: createdUser.firstName,
                lastName: createdUser.lastName,
                role: createdUser.role,
                isActive: createdUser.isActive,
              };
            } else {
              // Update existing database user
              const updatedUser = await prisma.user.update({
                where: { id: existingAuthUser.id },
                data: {
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  about: profile.about,
                  hobbies: profile.hobbies,
                  preferredActivity: profile.preferredActivity,
                  interests: profile.interests,
                  profileImageUrl: avatarUrl ?? null,
                  role: profile.role,
                  organizationId: orgId,
                  updatedAt: new Date(),
                },
              });
              console.log(
                `✅ Updated database user: ${profile.firstName} ${profile.lastName} (${profile.role})`
              );
              return {
                id: updatedUser.id,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                role: updatedUser.role,
                isActive: updatedUser.isActive,
              };
            }
          }
        }
      } else {
        console.error(`❌ Failed to create Supabase user ${email}:`, authError);
      }
      return null;
    }

    if (!authData.user) {
      console.error(`❌ No Supabase user returned for ${email}`);
      return null;
    }

    // Check if database user already exists with this Supabase user ID
    const existingDbUserByAuth = await prisma.user.findUnique({
      where: { id: authData.user.id },
    });

    if (existingDbUserByAuth) {
      // Database user already exists, just update it
      const updatedUser = await prisma.user.update({
        where: { id: authData.user.id },
        data: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          about: profile.about,
          hobbies: profile.hobbies,
          preferredActivity: profile.preferredActivity,
          interests: profile.interests,
          profileImageUrl: avatarUrl ?? null,
          role: profile.role,
          organizationId: orgId,
          updatedAt: new Date(),
        },
      });
      console.log(
        `✅ Updated user: ${profile.firstName} ${profile.lastName} (${profile.role}) - ${email}`
      );
      return {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      };
    }

    // Create user in database with Supabase user ID
    const createdUser = await prisma.user.create({
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
        profileImageUrl: avatarUrl ?? null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(
      `✅ Created user: ${profile.firstName} ${profile.lastName} (${profile.role}) - ${email}`
    );

    return {
      id: createdUser.id,
      firstName: createdUser.firstName,
      lastName: createdUser.lastName,
      role: createdUser.role,
      isActive: createdUser.isActive,
    };
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error creating demo user (${userKey}): ${err}`);
    return null;
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
    avatarFileName: "org_admin.jpeg",
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
    avatarFileName: "user1.jpeg",
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
    avatarFileName: "user4.jpeg",
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
    avatarFileName: "user6.png",
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
    avatarFileName: "user8.jpeg",
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
 * Displays comprehensive seeding summary statistics
 * Shows:
 * - Overall counts for all data types
 * - Status breakdowns for pairings and periods
 * - Calendar event type distribution
 * - Per-organization breakdown
 * - Sample login credentials
 * - Demo data highlights
 * @param prisma - Prisma client instance
 * @returns Promise<void>
 */
async function displayEnhancedSummary(prisma: PrismaClient): Promise<void> {
  try {
    // Gather comprehensive statistics
    const stats = {
      organizations: await prisma.organization.count(),
      users: await prisma.user.count(),
      pairingPeriods: await prisma.pairingPeriod.count(),
      pairings: await prisma.pairing.count(),
      calendarEvents: await prisma.calendarEvent.count(),
      meetingEvents: await prisma.meetingEvent.count(),
    };

    // Get status breakdowns
    const pairingsByStatus = await prisma.pairing.groupBy({
      by: ["status"],
      _count: true,
    });

    const eventsByType = await prisma.calendarEvent.groupBy({
      by: ["type"],
      _count: true,
    });

    const periodsByStatus = await prisma.pairingPeriod.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get per-org breakdown
    const organizations = await prisma.organization.findMany({
      include: {
        _count: {
          select: {
            users: true,
            pairings: true,
            pairingPeriods: true,
          },
        },
      },
    });

    // Display overall summary
    console.log("📊 SEEDING SUMMARY");
    console.log("=".repeat(50));
    console.log(`🏢 Organizations:     ${stats.organizations}`);
    console.log(`👥 Users:             ${stats.users}`);
    console.log(`🗓️  Pairing Periods:   ${stats.pairingPeriods}`);
    console.log(`🤝 Pairings:          ${stats.pairings}`);
    console.log(`📅 Calendar Events:   ${stats.calendarEvents}`);
    console.log(`📆 Meeting Events:    ${stats.meetingEvents}`);

    // Display period status breakdown
    console.log("\n🗓️  Pairing Period Status:");
    for (const group of periodsByStatus) {
      console.log(`   ${group.status}: ${group._count}`);
    }

    // Display pairing status breakdown
    console.log("\n🤝 Pairing Status Breakdown:");
    for (const group of pairingsByStatus.sort((a, b) =>
      a.status.localeCompare(b.status)
    )) {
      console.log(`   ${group.status}: ${group._count}`);
    }

    // Display calendar event types
    console.log("\n📅 Calendar Event Types:");
    for (const group of eventsByType) {
      console.log(`   ${group.type}: ${group._count}`);
    }

    // Display per-organization breakdown
    console.log("\n🏢 Per-Organization Breakdown:");
    for (const org of organizations) {
      console.log(`\n   ${org.name} (${org.code}):`);
      console.log(`      Users: ${org._count.users}`);
      console.log(`      Periods: ${org._count.pairingPeriods}`);
      console.log(`      Pairings: ${org._count.pairings}`);
    }

    // Display login credentials and highlights
    console.log("\n🔐 Sample Login Credentials:");
    console.log("   Organization: Torus Technologies Inc");
    console.log("   Email: super_admin_torus@torus.com");
    console.log("   Password: Password123!");

    console.log("\n✨ Demo Data Highlights:");
    console.log("   - Pairing periods: 3-week cycles (active + upcoming)");
    console.log("   - Active period: 1 week in, 2 weeks remaining");
    console.log("   - Mixed pairing statuses for realistic scenarios");
    console.log("   - Calendar events show availability/unavailability patterns");
    console.log("   - Meeting events scheduled for matched/met pairings");
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error("❌ Error generating summary:", err);
  }
}

/**
 * Main orchestrator function for seeding demo data
 * Orchestrates seeding in phases:
 * - Phase 1: Organizations
 * - Phase 2: Users, Pairing Periods, Pairings, Calendar Events, Meeting Events
 * - Phase 3: Summary Statistics
 * @returns void
 * @throws Error if required environment variables are missing or database operations fail
 */
async function main(): Promise<void> {
  console.log("🚀 Starting Torus demo data seeding...\n");

  // Check required environment variables
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Missing required environment variables:\n" +
        "  - SUPABASE_URL\n" +
        "  - SUPABASE_SECRET_KEY\n\n" +
        "Please set these in your .env file."
    );
  }

  // Diagnostic: Check Supabase Storage bucket access
  try {
    const supabaseStorage = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: buckets, error: bucketsError } =
      await supabaseStorage.storage.listBuckets();
    if (bucketsError) {
      console.warn(
        `⚠️  Warning: Could not list Supabase buckets: ${bucketsError.message}`
      );
      console.warn(
        "   Avatar uploads will be skipped, but seeding will continue.\n"
      );
    } else if (buckets && !buckets.some((b) => b.name === "profile-pictures")) {
      console.warn(
        `⚠️  Warning: 'profile-pictures' bucket not found in Supabase Storage`
      );
      console.warn(
        "   Available buckets:",
        buckets.map((b) => b.name).join(", ")
      );
      console.warn(
        "   Avatar uploads will be skipped, but seeding will continue.\n"
      );
    }
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Warning: Supabase storage check failed: ${err}`);
    console.warn(
      "   Avatar uploads will be skipped, but seeding will continue.\n"
    );
  }

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log("📦 Connected to database\n");

    // ========================================
    // PHASE 1: Organizations
    // ========================================
    console.log("🏢 PHASE 1: Creating Organizations");
    console.log("=".repeat(50));
    const organizationIds: string[] = [];
    for (const orgConfig of ORGANIZATIONS) {
      const orgId = await createDemoOrganization(prisma, orgConfig);
      organizationIds.push(orgId);
    }

    // ========================================
    // PHASE 2: Users & Related Data
    // ========================================
    console.log("\n👥 PHASE 2: Creating Users & Pairing Data");
    console.log("=".repeat(50));

    const userKeys = [
      "super_admin",
      "org_admin",
      ...Array.from({ length: 9 }, (_, i) => `user${i + 1}`),
    ];

    for (let i = 0; i < organizationIds.length; i++) {
      const orgId = organizationIds[i];
      const orgConfig = ORGANIZATIONS[i];

      console.log(`\n📍 Organization: ${orgConfig.name}`);
      console.log("-".repeat(50));

      // 2a. Create users for this org
      const users: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        role: string;
        isActive: boolean;
      }[] = [];

      console.log("Creating users...");
      for (const userKey of userKeys) {
        // Generate email from profile name and org code
        const profile = USER_PROFILES[userKey as keyof typeof USER_PROFILES];
        if (!profile) continue;

        // Create email: FirstName.LastName_OrgCode format
        const email = `${profile.firstName.toLowerCase()}.${profile.lastName.toLowerCase()}_${orgConfig.code.toLowerCase()}@torus.com`;
        const user = await createDemoUser(prisma, userKey, orgId, email);
        if (user) {
          users.push(user);
        }
      }

      // 2b. Create pairing periods (3 weeks each)
      console.log("\n🗓️  Creating pairing periods...");
      const { activePeriodId, upcomingPeriodId } =
        await createPairingPeriodsForOrg(prisma, orgId);

      // 2c. Create pairings (only for active period)
      console.log("\n🤝 Creating pairings...");
      const pairings = await createPairingsForOrg(
        prisma,
        orgId,
        activePeriodId,
        users
      );

      // 2d. Create calendar events for each regular user
      console.log("\n📅 Creating calendar events...");
      const regularUsers = users.filter((u) => u.role === "user");
      for (const user of regularUsers) {
        await createCalendarEventsForUser(prisma, user.id);
      }

      // 2e. Create meeting events for matched/met pairings
      console.log("\n📆 Creating meeting events...");
      for (const pairing of pairings) {
        if (pairing.status === "matched" || pairing.status === "met") {
          await createMeetingEventForPairing(prisma, pairing);
        }
      }
    }

    // ========================================
    // PHASE 3: Enhanced Summary Stats
    // ========================================
    console.log("\n" + "=".repeat(50));
    console.log("✅ SEEDING COMPLETED SUCCESSFULLY");
    console.log("=".repeat(50) + "\n");

    await displayEnhancedSummary(prisma);
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error("❌ Seeding failed:", err);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log("\n🔌 Database connection closed.");
  }
}

// Run the seed
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

