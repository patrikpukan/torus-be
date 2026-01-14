import { PrismaClient, UserRole } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

// Load environment variables
dotenv.config();

/**
 * Predefined hobby tags for demo data
 */
const HOBBY_TAGS = [
  "Photography",
  "Hiking",
  "Reading",
  "Cooking",
  "Gaming",
  "Running",
  "Cycling",
  "Painting",
  "Music",
  "Travel",
  "Gardening",
  "Yoga",
  "Swimming",
  "Dancing",
  "Crafts",
  "Chess",
  "Fishing",
  "Movies",
  "Theater",
  "Writing",
];

/**
 * Predefined interest tags for demo data
 */
const INTEREST_TAGS = [
  "Technology",
  "Sports",
  "Art",
  "Science",
  "Business",
  "Culture",
  "Food",
  "Environment",
  "Health",
  "Innovation",
  "Design",
  "Marketing",
  "Finance",
  "Education",
  "Politics",
  "History",
  "Fashion",
  "Architecture",
  "Psychology",
  "Music",
];

/**
 * Realistic locations for demo users
 */
const LOCATIONS = [
  "Prague, Czech Republic",
  "Berlin, Germany",
  "London, United Kingdom",
  "Amsterdam, Netherlands",
  "Barcelona, Spain",
  "Vienna, Austria",
  "Warsaw, Poland",
  "Budapest, Hungary",
  "Remote, Worldwide",
];

/**
 * Realistic job positions for demo users
 */
const POSITIONS = [
  "Senior Software Engineer",
  "Product Manager",
  "UX Designer",
  "Marketing Specialist",
  "Sales Director",
  "HR Manager",
  "Financial Analyst",
  "Operations Coordinator",
  "DevOps Engineer",
  "Data Scientist",
  "Customer Success Manager",
];

/**
 * Detailed department definitions for organizations
 * Maps organization names to their departments with descriptions
 */
const DEPARTMENTS_BY_ORG: Record<
  string,
  Array<{ name: string; description: string }>
> = {
  "Torus Technologies Inc": [
    {
      name: "Engineering",
      description:
        "Core development team responsible for building and maintaining software products",
    },
    {
      name: "Product",
      description: "Product strategy, roadmap, and user experience design team",
    },
    {
      name: "DevOps",
      description:
        "Infrastructure, deployment, and system reliability engineering",
    },
    {
      name: "QA",
      description:
        "Quality assurance, testing, and automated test infrastructure",
    },
    {
      name: "Data Science",
      description: "Analytics, machine learning, and data-driven insights team",
    },
  ],
  "StartupHub Ventures": [
    {
      name: "Sales",
      description:
        "Client acquisition, account management, and business development",
    },
    {
      name: "Customer Success",
      description: "Client onboarding, support, and retention team",
    },
    {
      name: "Marketing",
      description: "Brand management, campaigns, and market research team",
    },
    {
      name: "Operations",
      description:
        "Business processes, administration, and operational efficiency",
    },
    {
      name: "Finance",
      description: "Accounting, budgeting, and financial planning team",
    },
  ],
  "Digital Minds Collective": [
    {
      name: "Design",
      description: "UI/UX design, visual design, and design systems team",
    },
    {
      name: "Content",
      description: "Content creation, copywriting, and editorial team",
    },
    {
      name: "Production",
      description: "Project management, production coordination, and timelines",
    },
    {
      name: "Creative Strategy",
      description:
        "Strategic planning, creative direction, and brand positioning",
    },
  ],
};

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
  preferredActivity: string;
  location: string;
  position: string;
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
 * Seeds predefined tags for hobbies and interests
 * Idempotent: checks if tags exist before creating
 * @param prisma - Prisma client instance
 * @returns Object containing arrays of hobby and interest tags
 */
async function seedTags(prisma: PrismaClient) {
  console.log("🏷️  Seeding predefined tags...");

  const hobbyTags: Array<{ id: string; name: string; category: string }> = [];
  const interestTags: Array<{ id: string; name: string; category: string }> =
    [];

  // Create hobby tags (idempotent)
  for (const name of HOBBY_TAGS) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: {
        name,
        category: "HOBBY",
      },
    });
    hobbyTags.push({
      id: tag.id,
      name: tag.name,
      category: tag.category,
    });
  }

  // Create interest tags (idempotent)
  for (const name of INTEREST_TAGS) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: {
        name,
        category: "INTEREST",
      },
    });
    interestTags.push({
      id: tag.id,
      name: tag.name,
      category: tag.category,
    });
  }

  console.log(`  ✅ Created ${hobbyTags.length} hobby tags`);
  console.log(`  ✅ Created ${interestTags.length} interest tags`);

  return { hobbyTags, interestTags };
}

/**
 * Gets random items from an array
 * @param array - Array to select from
 * @param count - Number of items to select
 * @returns Array of random items
 */
function getRandomTags<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Gets random string from array
 * @param array - Array to select from
 * @returns Random item from array
 */
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Assigns random tags to a user
 * @param prisma - Prisma client instance
 * @param userId - User ID to assign tags to
 * @param hobbyTags - Available hobby tags
 * @param interestTags - Available interest tags
 */
async function assignTagsToUser(
  prisma: PrismaClient,
  userId: string,
  hobbyTags: { id: string; name: string; category: string }[],
  interestTags: { id: string; name: string; category: string }[]
): Promise<void> {
  // Randomly select 3-6 hobbies
  const hobbyCount = Math.floor(Math.random() * 4) + 3; // 3-6
  const selectedHobbies = getRandomTags(hobbyTags, hobbyCount);

  // Randomly select 3-6 interests
  const interestCount = Math.floor(Math.random() * 4) + 3; // 3-6
  const selectedInterests = getRandomTags(interestTags, interestCount);

  // Assign hobby tags
  for (const hobby of selectedHobbies) {
    await prisma.userTag.upsert({
      where: {
        userId_tagId: {
          userId,
          tagId: hobby.id,
        },
      },
      update: {},
      create: {
        userId,
        tagId: hobby.id,
      },
    });
  }

  // Assign interest tags
  for (const interest of selectedInterests) {
    await prisma.userTag.upsert({
      where: {
        userId_tagId: {
          userId,
          tagId: interest.id,
        },
      },
      update: {},
      create: {
        userId,
        tagId: interest.id,
      },
    });
  }
}

/**
 * Seeds departments for an organization
 * Creates detailed department structure with descriptions
 * Idempotent: checks if departments exist before creating
 * @param prisma - Prisma client instance
 * @param orgId - Organization ID
 * @param orgName - Organization name to look up departments
 * @returns Array of created department IDs
 */
async function seedDepartmentsForOrg(
  prisma: PrismaClient,
  orgId: string,
  orgName: string
): Promise<string[]> {
  const departmentDefs = DEPARTMENTS_BY_ORG[orgName] || [];
  const createdDepartmentIds: string[] = [];

  if (departmentDefs.length === 0) {
    console.log(`  ℹ️  No departments defined for organization: ${orgName}`);
    return createdDepartmentIds;
  }

  for (const deptDef of departmentDefs) {
    try {
      const department = await prisma.department.upsert({
        where: {
          organizationId_name: {
            organizationId: orgId,
            name: deptDef.name,
          },
        },
        update: {
          description: deptDef.description,
        },
        create: {
          name: deptDef.name,
          description: deptDef.description,
          organizationId: orgId,
        },
      });
      createdDepartmentIds.push(department.id);
    } catch (error) {
      console.warn(
        `  ⚠️  Failed to create department ${deptDef.name} for org ${orgName}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  console.log(
    `  ✅ Seeded ${createdDepartmentIds.length} departments for ${orgName}`
  );
  return createdDepartmentIds;
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
 * Creates algorithm settings for an organization
 * Sets up the pairing algorithm configuration with sensible defaults
 * Idempotent: checks if settings already exist before creating
 * @param prisma - Prisma client instance
 * @param orgId - Organization ID
 * @returns Created AlgorithmSetting record
 */
async function createAlgorithmSettingsForOrg(
  prisma: PrismaClient,
  orgId: string
): Promise<{
  id: string;
  organizationId: string;
  startDate: Date | null;
  periodLengthDays: number | null;
  randomSeed: number | null;
}> {
  try {
    // Check if algorithm settings already exist for this org
    const existingSettings = await prisma.algorithmSetting.findUnique({
      where: { organizationId: orgId },
    });

    if (existingSettings) {
      console.log(
        `  ⚠️  Algorithm settings already exist for this org, skipping creation...`
      );
      return existingSettings;
    }

    // Create with default values
    const startDate = new Date(); // Start from today
    const periodLengthDays = 21; // 3-week periods
    const randomSeed = Math.floor(Math.random() * 2147483647); // Random seed for reproducibility

    const settings = await prisma.algorithmSetting.create({
      data: {
        organizationId: orgId,
        startDate,
        periodLengthDays,
        randomSeed,
      },
    });

    console.log(
      `  ✓ Algorithm settings created: Period=${periodLengthDays} days, Start=${startDate.toLocaleDateString()}, Seed=${randomSeed}`
    );

    return settings;
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error(
      `❌ Error creating algorithm settings for org ${orgId}:`,
      err
    );
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
    // Delete existing pairings for this period to ensure fresh data
    // Must delete related records first due to foreign key constraints
    const existingCount = await prisma.pairing.count({
      where: { periodId: activePeriodId },
    });

    if (existingCount > 0) {
      // First, find all pairing IDs for this period
      const pairingsToDelete = await prisma.pairing.findMany({
        where: { periodId: activePeriodId },
        select: { id: true },
      });

      const pairingIds = pairingsToDelete.map((p) => p.id);

      // Delete related records
      if (pairingIds.length > 0) {
        await prisma.report.deleteMany({
          where: { pairingId: { in: pairingIds } },
        });
        await prisma.meetingEvent.deleteMany({
          where: { pairingId: { in: pairingIds } },
        });
      }

      // Now delete the pairings
      await prisma.pairing.deleteMany({
        where: { periodId: activePeriodId },
      });
      console.log(`  🔄 Cleaned up ${existingCount} existing pairings`);
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
    // All eligible users should be paired (if odd number, last one remains unpaired)
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

    const totalEligible = eligibleUsers.length;
    const totalPaired = pairings.length * 2;

    console.log(
      `  ✓ Created ${pairings.length} pairings (${statusSummary}) - ${totalPaired}/${totalEligible} users paired`
    );

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
            rrule: Math.random() < 0.3 ? "FREQ=WEEKLY;BYDAY=MO,WE,FR" : null,
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

    const isPast = pairing.status === "met";

    // For met pairings, create 2-3 past meetings to accumulate more ratings
    const numMeetings = isPast ? 2 + Math.floor(Math.random() * 2) : 1;

    // Helper to get random weekday, moving weekends to Monday
    function getRandomWeekday(daysOffset: number): Date {
      const date = addDays(new Date(), daysOffset);
      const day = date.getDay();
      if (day === 0) date.setDate(date.getDate() + 1); // Sunday -> Monday
      if (day === 6) date.setDate(date.getDate() + 2); // Saturday -> Monday
      return date;
    }

    for (let meetingNum = 0; meetingNum < numMeetings; meetingNum++) {
      // Check if meeting already exists for this pairing at a different time
      const existingMeetings = await prisma.meetingEvent.findMany({
        where: { pairingId: pairing.id },
      });

      // For future meetings, only create one. For past meetings, allow multiple.
      if (!isPast && existingMeetings.length > 0) {
        console.log(`    ⚠️  Meeting already exists for pairing, skipping...`);
        return;
      }

      // Calculate meeting date based on pairing status
      let daysOffset: number;
      if (isPast) {
        // Space out multiple past meetings: first is -3 to -7 days, second is -10 to -21 days, etc.
        const baseOffset = -(3 + meetingNum * 7);
        daysOffset = baseOffset - Math.floor(Math.random() * 5);
      } else {
        daysOffset = 2 + Math.floor(Math.random() * 4);
      }

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
    }
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
 * Creates ratings for past meeting events
 * Generates realistic 1-5 star ratings with optional feedback
 * Only creates ratings for meetings that have already occurred
 * Both participants in a meeting will rate each other
 * @param prisma - Prisma client instance
 * @returns Promise<void>
 */
async function createRatingsForPastMeetings(prisma: PrismaClient): Promise<void> {
  try {
    // Find all past meetings (endDateTime is in the past)
    const pastMeetings = await prisma.meetingEvent.findMany({
      where: {
        endDateTime: {
          lt: new Date(),
        },
        cancelledAt: null,
      },
    });

    if (pastMeetings.length === 0) {
      console.log("    ℹ️  No past meetings found");
      return;
    }

    // Sample feedback messages
    const feedbackOptions = [
      "Great conversation and very insightful!",
      "Really enjoyed meeting and learning about their perspective.",
      "Excellent communicator and very approachable.",
      "Had meaningful discussion, looking forward to next meeting.",
      "Very professional and collaborative.",
      "Interesting ideas and good chemistry.",
      "Productive meeting with lots to discuss.",
      "Could tell they put thought into our conversation.",
      "Would definitely like to pair again!",
      "Appreciated their unique insights and perspective.",
      "Great energy and enthusiasm throughout the meeting.",
      "Looking forward to our next pairing session.",
      "Very thoughtful and considerate in our discussion.",
      "Made me think differently about the topic.",
      "Excellent listener and really engaged.",
    ];

    let ratingsCreated = 0;

    for (const meeting of pastMeetings) {
      // Check if ratings already exist for this meeting
      const existingRatings = await prisma.rating.findMany({
        where: { meetingEventId: meeting.id },
      });

      if (existingRatings.length >= 2) {
        continue; // Both users already rated
      }

      // Create ratings from both users
      // userA rates userB
      const ratingAExists = existingRatings.some(
        (r) => r.userId === meeting.userAId
      );
      if (!ratingAExists) {
        const starsA = Math.floor(Math.random() * 4) + 2; // 2-5 stars
        const feedbackA =
          feedbackOptions[
            Math.floor(Math.random() * feedbackOptions.length)
          ];

        await prisma.rating.create({
          data: {
            meetingEventId: meeting.id,
            userId: meeting.userAId,
            stars: starsA,
            feedback: feedbackA,
          },
        });
        ratingsCreated++;
      }

      // userB rates userA
      const ratingBExists = existingRatings.some(
        (r) => r.userId === meeting.userBId
      );
      if (!ratingBExists) {
        const starsB = Math.floor(Math.random() * 4) + 2; // 2-5 stars
        const feedbackB =
          feedbackOptions[
            Math.floor(Math.random() * feedbackOptions.length)
          ];

        await prisma.rating.create({
          data: {
            meetingEventId: meeting.id,
            userId: meeting.userBId,
            stars: starsB,
            feedback: feedbackB,
          },
        });
        ratingsCreated++;
      }
    }

    console.log(
      `    ✓ Created ${ratingsCreated} ratings for ${pastMeetings.length} past meetings`
    );
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error creating ratings for past meetings:`, err);
    // Don't throw - ratings are optional for demo
  }
}

/**
 * Creates user reports for some pairings (when pairings exist)
 * Generates realistic conflict/concern reports with various reasons
 * Idempotent: checks if reports already exist before creating
 * @param prisma - Prisma client instance
 * @param pairings - Array of pairings to potentially create reports for
 * @param users - Array of users that can be reporters
 * @returns Promise<void>
 */
async function createUserReportsForPairings(
  prisma: PrismaClient,
  pairings: Array<{ id: string; userAId: string; userBId: string }>,
  users: Array<{ id: string; role: string }>
): Promise<void> {
  try {
    if (pairings.length === 0 || users.length < 2) {
      return; // Need at least 2 users for a report
    }

    // Report reasons
    const reportReasons = [
      "Inappropriate behavior during pairing session",
      "Lack of professionalism in communication",
      "Disruptive behavior during meeting",
      "Not following pairing guidelines",
      "Creating uncomfortable atmosphere",
      "Refusing to participate in pairing activities",
    ];

    // Create reports for ~20% of pairings
    const reportsToCreate = Math.ceil(pairings.length * 0.2);
    const regularUsers = users.filter((u) => u.role === "user");

    if (regularUsers.length < 2) return;

    for (let i = 0; i < reportsToCreate; i++) {
      const pairing = pairings[Math.floor(Math.random() * pairings.length)];

      // Check if report already exists for this pairing
      const existingReport = await prisma.report.findFirst({
        where: { pairingId: pairing.id },
      });

      if (existingReport) {
        continue;
      }

      // Randomly choose reporter and reported user
      const reporterIsUserA = Math.random() > 0.5;
      const reporterId = reporterIsUserA ? pairing.userAId : pairing.userBId;
      const reportedUserId = reporterIsUserA
        ? pairing.userBId
        : pairing.userAId;

      const reason =
        reportReasons[Math.floor(Math.random() * reportReasons.length)];

      await prisma.report.create({
        data: {
          reporterId,
          reportedUserId,
          pairingId: pairing.id,
          reason,
          createdAt: addDays(new Date(), -(1 + Math.floor(Math.random() * 7))), // 1-7 days ago
        },
      });
    }

    console.log(`    ✓ Created user reports`);
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Warning: Could not create user reports: ${err}`);
    // Don't throw - reports are optional for demo
  }
}

/**
 * Creates user bans for some users in each organization
 * Generates realistic bans with various reasons
 * Idempotent: checks if bans already exist before creating
 * @param prisma - Prisma client instance
 * @param orgId - Organization ID
 * @param users - Array of users in the organization
 * @returns Promise<void>
 */
async function createUserBansForOrg(
  prisma: PrismaClient,
  orgId: string,
  users: Array<{ id: string; role: string }>
): Promise<void> {
  try {
    if (users.length < 2) {
      return; // Need at least 2 users (one to ban, one to ban by)
    }

    // Ban reasons
    const banReasons = [
      "Repeated violation of community guidelines",
      "Harassment or bullying behavior",
      "Inappropriate content or language",
      "Multiple complaints from other users",
      "Violation of pairing terms of service",
    ];

    const regularUsers = users.filter((u) => u.role === "user");
    const adminUsers = users.filter((u) => u.role === "org_admin");

    if (regularUsers.length === 0 || adminUsers.length === 0) {
      return;
    }

    // Ban ~10% of regular users
    const bansToCreate = Math.max(1, Math.floor(regularUsers.length * 0.1));
    const admin = adminUsers[0];

    for (let i = 0; i < bansToCreate; i++) {
      const userToBan = regularUsers[i % regularUsers.length];

      // Check if ban already exists for this user
      const existingBan = await prisma.ban.findFirst({
        where: { userId: userToBan.id, organizationId: orgId },
      });

      if (existingBan) {
        continue;
      }

      const reason = banReasons[Math.floor(Math.random() * banReasons.length)];
      const isPermanent = Math.random() > 0.7; // 30% permanent bans
      const expiresAt = isPermanent
        ? null
        : addDays(new Date(), 30 + Math.floor(Math.random() * 60)); // 30-90 days

      await prisma.ban.create({
        data: {
          organizationId: orgId,
          userId: userToBan.id,
          bannedById: admin.id,
          reason,
          createdAt: addDays(new Date(), -(1 + Math.floor(Math.random() * 14))), // 1-14 days ago
          expiresAt,
        },
      });
    }

    console.log(`    ✓ Created user bans`);
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Warning: Could not create user bans: ${err}`);
    // Don't throw - bans are optional for demo
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
      console.log(`  ⚠️  Avatar not found: ${avatarFileName}, skipping upload`);
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
    console.warn(`  ⚠️  Error uploading avatar ${avatarFileName}: ${err}`);
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

    // Create user in Supabase Auth (or handle if already exists)
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

    let authUserId: string | null = null;

    if (authError) {
      // Check if user already exists in Supabase Auth (by error code or message)
      const isEmailExists =
        (authError as any).code === "email_exists" ||
        authError.message?.includes("already exists") ||
        authError.message?.includes("already been registered");

      if (isEmailExists) {
        console.log(`⚠️  Supabase user already exists: ${email}`);

        // Try to get the existing user
        const { data, error: listError } =
          await supabaseAdmin.auth.admin.listUsers();
        if (!listError && data?.users) {
          const existingAuthUser = data.users.find((u) => u.email === email);
          if (existingAuthUser) {
            authUserId = existingAuthUser.id;
          }
        }
      } else {
        console.error(`❌ Failed to create Supabase user ${email}:`, authError);
        return null;
      }
    } else if (authData?.user) {
      authUserId = authData.user.id;
    } else {
      console.error(`❌ No Supabase user ID returned for ${email}`);
      return null;
    }

    if (!authUserId) {
      console.error(`❌ Could not obtain auth user ID for ${email}`);
      return null;
    }

    // Upload avatar using the actual auth user ID
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
          preferredActivity: profile.preferredActivity,
          location: profile.location,
          position: profile.position,
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

    // Create user in database with Supabase user ID
    const createdUser = await prisma.user.create({
      data: {
        id: authUserId,
        supabaseUserId: authUserId,
        email,
        emailVerified: true,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: profile.role,
        organizationId: orgId,
        about: profile.about,
        preferredActivity: profile.preferredActivity,
        location: profile.location,
        position: profile.position,
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
    preferredActivity: "Coffee",
    location: "Prague, Czech Republic",
    position: "Senior Software Engineer",
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
    preferredActivity: "Lunch",
    location: "Berlin, Germany",
    position: "Product Manager",
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
    preferredActivity: "Coffee",
    location: "London, United Kingdom",
    position: "UX Designer",
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
    preferredActivity: "Lunch",
    location: "Amsterdam, Netherlands",
    position: "Marketing Specialist",
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
    preferredActivity: "Walk",
    location: "Barcelona, Spain",
    position: "Sales Director",
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
    preferredActivity: "Video Call",
    location: "Vienna, Austria",
    position: "HR Manager",
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
    preferredActivity: "Phone Call",
    location: "Warsaw, Poland",
    position: "Financial Analyst",
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
    preferredActivity: "Walk",
    location: "Budapest, Hungary",
    position: "Operations Coordinator",
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
    preferredActivity: "Coffee",
    location: "Remote, Worldwide",
    position: "DevOps Engineer",
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
    preferredActivity: "Lunch",
    location: "Prague, Czech Republic",
    position: "Data Scientist",
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
    preferredActivity: "Video Call",
    location: "Berlin, Germany",
    position: "Customer Success Manager",
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
      ratings: await prisma.rating.count(),
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
    console.log(`⭐ Ratings:           ${stats.ratings}`);

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
    console.log(
      "   - Calendar events show availability/unavailability patterns"
    );
    console.log("   - Meeting events scheduled for matched/met pairings");
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error("❌ Error generating summary:", err);
  }
}

/**
 * Seeds initial achievements into the database
 * Idempotent: uses upsert to avoid duplicates
 * @param prisma - Prisma client instance
 * @returns Promise<void>
 */
async function seedAchievements(prisma: PrismaClient): Promise<void> {
  const ACHIEVEMENTS = [
    {
      name: "Newcomer",
      description: "Completed your first successful pairing and meeting",
      imageIdentifier: "newcomer",
      type: "milestone" as const,
      pointValue: 10,
      unlockCondition: "Complete first meeting with pairing",
    },
    {
      name: "Social Butterfly",
      description: "Met with 10 different people",
      imageIdentifier: "social-butterfly",
      type: "social" as const,
      pointValue: 50,
      unlockCondition: "Complete 10 meetings with different users",
    },
    {
      name: "Bridge Builder",
      description: "Connected with someone from a different department",
      imageIdentifier: "bridge-builder",
      type: "social" as const,
      pointValue: 25,
      unlockCondition: "Complete meeting with user from different department",
    },
    {
      name: "Regular Participant",
      description: "Participated in 10 consecutive pairing cycles",
      imageIdentifier: "regular-participant",
      type: "consistency" as const,
      pointValue: 40,
      unlockCondition: "Participate in 10 consecutive pairing cycles",
    },
    {
      name: "Pairing Legend",
      description: "Completed 50 meetings total",
      imageIdentifier: "pairing-legend",
      type: "legendary" as const,
      pointValue: 100,
      unlockCondition: "Complete 50 total meetings",
    },
  ];

  try {
    for (const achievement of ACHIEVEMENTS) {
      await (prisma as any).achievement.upsert({
        where: { name: achievement.name },
        update: {
          description: achievement.description,
          imageIdentifier: achievement.imageIdentifier,
          type: achievement.type,
          pointValue: achievement.pointValue,
          unlockCondition: achievement.unlockCondition,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          name: achievement.name,
          description: achievement.description,
          imageIdentifier: achievement.imageIdentifier,
          type: achievement.type,
          pointValue: achievement.pointValue,
          unlockCondition: achievement.unlockCondition,
          isActive: true,
        },
      });
    }

    console.log(`  ✓ Seeded 5 achievements`);
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Warning: Could not seed achievements: ${err}`);
  }
}

/**
 * Unlocks demo achievements for demo users to showcase the full achievement UI
 * For the first regular user (user1) in each organization:
 * - Newcomer: Always unlocked (first meeting)
 * - Social Butterfly: If user has 10+ meetings with different people
 * - Bridge Builder: If user has meeting with someone from different department
 * - Regular Participant: If user has participated in 10+ consecutive cycles
 * - Pairing Legend: If user has 50+ total meetings
 * @param prisma - Prisma client instance
 * @returns Promise<void>
 */
async function unlockDemoAchievements(prisma: PrismaClient): Promise<void> {
  try {
    // Get all achievements
    const achievements = await (prisma as any).achievement.findMany({
      where: { isActive: true },
    });

    if (achievements.length === 0) {
      console.log("  ℹ️  No achievements found");
      return;
    }

    // Get all regular users (role = 'user') ordered by creation date
    const users = await prisma.user.findMany({
      where: { role: UserRole.user, isActive: true },
      orderBy: { createdAt: "asc" },
      include: {
        ratings: true,
      },
    });

    if (users.length === 0) {
      console.log("  ℹ️  No regular users found");
      return;
    }

    // For demo purposes, unlock achievements for users with ratings
    let achievementsUnlocked = 0;
    let progressCreated = 0;

    // Assign specific achievements to early users for demo purposes
    if (users.length > 0) {
      // First user gets Newcomer + Social Butterfly
      const firstUser = users[0];
      const newcomer = achievements.find(
        (a) => a.imageIdentifier === "newcomer"
      );
      if (newcomer) {
        const existing = await (prisma as any).userAchievement.findFirst({
          where: { userId: firstUser.id, achievementId: newcomer.id },
        });
        if (!existing) {
          await (prisma as any).userAchievement.create({
            data: {
              userId: firstUser.id,
              achievementId: newcomer.id,
              unlockedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
              currentProgress: 1,
            },
          });
          achievementsUnlocked++;
        }
      }

      const socialButterfly = achievements.find(
        (a) => a.imageIdentifier === "social-butterfly"
      );
      if (socialButterfly) {
        const existing = await (prisma as any).userAchievement.findFirst({
          where: { userId: firstUser.id, achievementId: socialButterfly.id },
        });
        if (!existing) {
          await (prisma as any).userAchievement.create({
            data: {
              userId: firstUser.id,
              achievementId: socialButterfly.id,
              unlockedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
              currentProgress: 2,
            },
          });
          achievementsUnlocked++;
        }
      }
    }

    if (users.length > 1) {
      // Second user gets Pairing Legend
      const secondUser = users[1];
      const pairingLegend = achievements.find(
        (a) => a.imageIdentifier === "pairing-legend"
      );
      if (pairingLegend) {
        const existing = await (prisma as any).userAchievement.findFirst({
          where: { userId: secondUser.id, achievementId: pairingLegend.id },
        });
        if (!existing) {
          await (prisma as any).userAchievement.create({
            data: {
              userId: secondUser.id,
              achievementId: pairingLegend.id,
              unlockedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
              currentProgress: 3,
            },
          });
          achievementsUnlocked++;
        }
      }

      // Second user also gets partial progress on Bridge Builder
      const bridgeBuilder = achievements.find(
        (a) => a.imageIdentifier === "bridge-builder"
      );
      if (bridgeBuilder) {
        const existing = await (prisma as any).userAchievement.findFirst({
          where: { userId: secondUser.id, achievementId: bridgeBuilder.id },
        });
        if (!existing) {
          await (prisma as any).userAchievement.create({
            data: {
              userId: secondUser.id,
              achievementId: bridgeBuilder.id,
              unlockedAt: null, // Explicitly set to null for in-progress achievements
              currentProgress: 8, // 8 out of 20 ratings from different people
            },
          });
          progressCreated++;
        }
      }
    }

    if (users.length > 2) {
      // Third user gets Newcomer + partial progress on Regular Participant
      const thirdUser = users[2];
      const newcomer = achievements.find(
        (a) => a.imageIdentifier === "newcomer"
      );
      if (newcomer) {
        const existing = await (prisma as any).userAchievement.findFirst({
          where: { userId: thirdUser.id, achievementId: newcomer.id },
        });
        if (!existing) {
          await (prisma as any).userAchievement.create({
            data: {
              userId: thirdUser.id,
              achievementId: newcomer.id,
              unlockedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
              currentProgress: 1,
            },
          });
          achievementsUnlocked++;
        }
      }

      // Third user has partial progress on Regular Participant
      const regularParticipant = achievements.find(
        (a) => a.imageIdentifier === "regular-participant"
      );
      if (regularParticipant) {
        const existing = await (prisma as any).userAchievement.findFirst({
          where: { userId: thirdUser.id, achievementId: regularParticipant.id },
        });
        if (!existing) {
          await (prisma as any).userAchievement.create({
            data: {
              userId: thirdUser.id,
              achievementId: regularParticipant.id,
              unlockedAt: null, // Explicitly set to null for in-progress achievements
              currentProgress: 5, // 5 out of 10 cycles
            },
          });
          progressCreated++;
        }
      }
    }

    // For remaining users, add partial progress on locked achievements
    for (let i = 3; i < users.length; i++) {
      const user = users[i];

      const regularParticipant = achievements.find(
        (a) => a.imageIdentifier === "regular-participant"
      );
      if (regularParticipant) {
        const existing = await (prisma as any).userAchievement.findFirst({
          where: { userId: user.id, achievementId: regularParticipant.id },
        });
        if (!existing) {
          // Set progress to 1-3 out of 10 cycles
          await (prisma as any).userAchievement.create({
            data: {
              userId: user.id,
              achievementId: regularParticipant.id,
              unlockedAt: null, // Explicitly set to null for in-progress achievements
              currentProgress: Math.floor(Math.random() * 3) + 1,
            },
          });
          progressCreated++;
        }
      }

      const bridgeBuilder = achievements.find(
        (a) => a.imageIdentifier === "bridge-builder"
      );
      if (bridgeBuilder) {
        const existing = await (prisma as any).userAchievement.findFirst({
          where: { userId: user.id, achievementId: bridgeBuilder.id },
        });
        if (!existing) {
          // Set progress to 0-5 out of 20 ratings from different people
          await (prisma as any).userAchievement.create({
            data: {
              userId: user.id,
              achievementId: bridgeBuilder.id,
              unlockedAt: null, // Explicitly set to null for in-progress achievements
              currentProgress: Math.floor(Math.random() * 5),
            },
          });
          progressCreated++;
        }
      }
    }

    console.log(`  ✓ Unlocked ${achievementsUnlocked} demo achievements`);
    console.log(`  ✓ Created ${progressCreated} achievement progress entries`);
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Warning: Could not unlock demo achievements: ${err}`);
  }
}

async function seedCycleParticipation(prisma: PrismaClient): Promise<void> {
  try {
    // Get all regular users and their organizations
    const users = await prisma.user.findMany({
      where: { role: UserRole.user, isActive: true },
      include: { organization: true },
    });

    if (users.length === 0) {
      console.log("  ℹ️  No users found");
      return;
    }

    let cycleParticipationsCreated = 0;

    for (const user of users) {
      if (!user.organization) continue;

      // Check if cycle participation already exists
      const existing = await (prisma as any).cycleParticipation.findFirst({
        where: {
          userId: user.id,
          organizationId: user.organizationId,
        },
      });

      if (!existing) {
        // Generate realistic consecutive cycle counts (1-12 cycles)
        // Higher numbers are less frequent (more users with fewer cycles)
        const rand = Math.random();
        let consecutiveCount = 1;
        
        if (rand < 0.2) consecutiveCount = 1; // 20% have 1 cycle
        else if (rand < 0.35) consecutiveCount = 2; // 15% have 2 cycles
        else if (rand < 0.48) consecutiveCount = 3; // 13% have 3 cycles
        else if (rand < 0.58) consecutiveCount = 4; // 10% have 4 cycles
        else if (rand < 0.66) consecutiveCount = 5; // 8% have 5 cycles
        else if (rand < 0.72) consecutiveCount = 6; // 6% have 6 cycles
        else if (rand < 0.78) consecutiveCount = 7; // 6% have 7 cycles
        else if (rand < 0.82) consecutiveCount = 8; // 4% have 8 cycles
        else if (rand < 0.86) consecutiveCount = 9; // 4% have 9 cycles
        else if (rand < 0.89) consecutiveCount = 10; // 3% have 10 cycles
        else if (rand < 0.94) consecutiveCount = 11; // 5% have 11 cycles
        else consecutiveCount = 12; // 6% have 12+ cycles (regular participants)

        // Create cycle participation record
        await (prisma as any).cycleParticipation.create({
          data: {
            userId: user.id,
            organizationId: user.organizationId,
            consecutiveCount,
            lastParticipationCycle: consecutiveCount, // Track which cycle they last participated in
            createdAt: new Date(Date.now() - consecutiveCount * 21 * 24 * 60 * 60 * 1000), // Each cycle is ~3 weeks
          },
        });
        cycleParticipationsCreated++;
      }
    }

    console.log(`  ✓ Created ${cycleParticipationsCreated} cycle participation records`);
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Warning: Could not seed cycle participation: ${err}`);
  }
}

/**
 * Cleans up demo Supabase Auth users created during seeding
 * Deletes all users from Supabase Auth that match the demo user email patterns
 * This ensures a clean state for re-seeding without orphaned auth users
 * @returns Promise<void>
 */
async function cleanupSupabaseAuthUsers(): Promise<void> {
  console.log("🧹 Cleaning up Supabase Auth users...\n");

  try {
    if (!supabaseUrl || !supabaseSecretKey) {
      console.log("⚠️  Skipping Supabase cleanup (credentials not configured)");
      return;
    }

    // Get all users from Supabase
    const { data: allUsers, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.warn(`⚠️  Could not list Supabase users: ${listError.message}`);
      return;
    }

    if (!allUsers?.users || allUsers.users.length === 0) {
      console.log("ℹ️  No users found in Supabase Auth");
      return;
    }

    // Filter demo users based on email patterns
    const demoEmailPatterns = [
      "superadmin@torus.com",
      "orgadmin@torus.com",
      "@torus.com", // Any @torus.com email is likely a demo user
    ];

    const demoUsers = allUsers.users.filter((user) => {
      if (!user.email) return false;
      return demoEmailPatterns.some((pattern) => user.email?.includes(pattern));
    });

    if (demoUsers.length === 0) {
      console.log("ℹ️  No demo users found to clean up");
      return;
    }

    // Delete each demo user
    let deletedCount = 0;
    for (const user of demoUsers) {
      try {
        const { error: deleteError } =
          await supabaseAdmin.auth.admin.deleteUser(user.id);

        if (deleteError) {
          console.warn(
            `⚠️  Failed to delete user ${user.email}: ${deleteError.message}`
          );
        } else {
          deletedCount++;
          console.log(`  ✓ Deleted: ${user.email}`);
        }
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️  Error deleting user ${user.email}: ${err}`);
      }
    }

    console.log(
      `\n✅ Cleaned up ${deletedCount} demo users from Supabase Auth\n`
    );
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Warning: Supabase cleanup incomplete: ${err}`);
    console.warn("   Proceeding with seeding anyway...\n");
  }
}

/**
 * Main orchestrator function for seeding demo data
 * Orchestrates seeding in phases:
 * - Phase 0: Cleanup (delete demo users from Supabase Auth)
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
    // PHASE 0: Cleanup Supabase Auth Users
    // ========================================
    console.log("🧹 PHASE 0: Cleaning up demo users from Supabase Auth");
    console.log("=".repeat(50));
    await cleanupSupabaseAuthUsers();

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
    // PHASE 1.5: Tags & Achievements
    // ========================================
    console.log("\n🏷️  PHASE 1.5: Seeding Tags & Achievements");
    console.log("=".repeat(50));
    const { hobbyTags, interestTags } = await seedTags(prisma);

    console.log("\n🏆 PHASE 1.6: Seeding Achievements");
    await seedAchievements(prisma);

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

      // 2a. Create departments for this org
      console.log("Creating departments...");
      const departmentIds = await seedDepartmentsForOrg(
        prisma,
        orgId,
        orgConfig.name
      );

      // 2b. Create users for this org
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

          // Assign random tags (hobbies and interests) to all users
          await assignTagsToUser(prisma, user.id, hobbyTags, interestTags);

          // Assign all users to a random department (if departments exist)
          if (departmentIds.length > 0) {
            const randomDepartmentId = getRandomItem(departmentIds);
            await prisma.user.update({
              where: { id: user.id },
              data: { departmentId: randomDepartmentId },
            });
          }
        }
      }

      // 2c. Create pairing periods (3 weeks each)
      console.log("\n🗓️  Creating pairing periods...");
      const { activePeriodId, upcomingPeriodId } =
        await createPairingPeriodsForOrg(prisma, orgId);

      // 2c.5. Create algorithm settings for the organization
      console.log("\n⚙️  Creating algorithm settings...");
      await createAlgorithmSettingsForOrg(prisma, orgId);

      // 2d. Create pairings (only for active period)
      console.log("\n🤝 Creating pairings...");
      const pairings = await createPairingsForOrg(
        prisma,
        orgId,
        activePeriodId,
        users
      );

      // 2e. Create calendar events for each regular user
      console.log("\n📅 Creating calendar events...");
      const regularUsers = users.filter((u) => u.role === "user");
      for (const user of regularUsers) {
        await createCalendarEventsForUser(prisma, user.id);
      }

      // 2f. Create meeting events for matched/met pairings
      console.log("\n📆 Creating meeting events...");
      for (const pairing of pairings) {
        if (pairing.status === "matched" || pairing.status === "met") {
          await createMeetingEventForPairing(prisma, pairing);
        }
      }

      // 2g. Create ratings for past meetings
      console.log("\n⭐ Creating meeting ratings...");
      await createRatingsForPastMeetings(prisma);

      // 2h. Create user reports for some pairings
      console.log("\n📋 Creating user reports...");
      await createUserReportsForPairings(prisma, pairings, users);

      // 2i. Create user bans for organization
      console.log("\n🚫 Creating user bans...");
      await createUserBansForOrg(prisma, orgId, users);
    }

    // ========================================
    // PHASE 3: Unlock Demo Achievements
    // ========================================
    console.log("\n" + "=".repeat(50));
    console.log("🏆 PHASE 3: Unlocking Demo Achievements");
    console.log("=".repeat(50));
    await unlockDemoAchievements(prisma);

    // ========================================
    // PHASE 4: Seeding Cycle Participation
    // ========================================
    console.log("\n" + "=".repeat(50));
    console.log("🔄 PHASE 4: Seeding Cycle Participation Data");
    console.log("=".repeat(50));
    await seedCycleParticipation(prisma);

    // ========================================
    // PHASE 5: Enhanced Summary Stats
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
