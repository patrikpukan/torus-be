import { INestApplication, Injectable } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "crypto";
import { sign } from "jsonwebtoken";
import {
  PairingStatus,
  PairingPeriodStatus,
  ProfileStatus,
  UserRole,
} from "@prisma/client";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/core/prisma/prisma.service";
import { Config } from "../src/shared/config/config.service";
import { PairingAlgorithmService, InsufficientUsersException } from "../src/pairing-algorithm/pairing-algorithm.service";

describe("Pairing Algorithm E2E", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let config: Config;
  let adminToken: string;
  let userToken: string;
  let testOrgId: string;
  let adminUserId: string;
  let regularUserId: string;
  const createdOrganizationIds: string[] = [];

  jest.setTimeout(20000);

  @Injectable()
  class E2EPairingAlgorithmService {
    constructor(private readonly prisma: PrismaService) {}

    async executePairing(organizationId: string): Promise<void> {
      const activeUsers = await this.prisma.user.findMany({
        where: {
          organizationId,
          isActive: true,
          OR: [{ suspendedUntil: null }, { suspendedUntil: { lt: new Date() } }],
        },
        orderBy: { createdAt: "asc" },
      });

      if (activeUsers.length < 2) {
        throw new InsufficientUsersException(organizationId, activeUsers.length);
      }

      await this.prisma.$transaction(async (tx) => {
        const existingPeriod = await tx.pairingPeriod.findFirst({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
        });

        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + 21 * 24 * 60 * 60 * 1000);

        const period = existingPeriod
          ? existingPeriod
          : await tx.pairingPeriod.create({
              data: {
                organizationId,
                status: PairingPeriodStatus.active,
                startDate,
                endDate,
              },
            });

        await tx.pairing.deleteMany({ where: { organizationId, periodId: period.id } });

        const pairs = [] as Array<{ userAId: string; userBId: string }>;
        for (let index = 0; index + 1 < activeUsers.length; index += 2) {
          pairs.push({ userAId: activeUsers[index].id, userBId: activeUsers[index + 1].id });
        }

        if (pairs.length === 0) {
          return;
        }

        await tx.pairing.createMany({
          data: pairs.map((pair) => ({
            organizationId,
            periodId: period.id,
            userAId: pair.userAId,
            userBId: pair.userBId,
            status: PairingStatus.planned,
          })),
        });
      });
    }

    async executeScheduledPairing(): Promise<void> {
      return;
    }
  }

  const jwtSecret = () => config.supabaseJwtSecret ?? "test-secret";

  const graphql = (token?: string) => {
    const builder = request(app.getHttpServer()).post("/graphql");
    if (token) {
      builder.set("Authorization", `Bearer ${token}`);
    }
    return builder;
  };

  const cleanupOrganization = async (organizationId: string) => {
    const periods = await prisma.pairingPeriod.findMany({
      where: { organizationId },
      select: { id: true },
    });
    const periodIds = periods.map((period) => period.id);

    if (periodIds.length > 0) {
      await prisma.pairing.deleteMany({ where: { periodId: { in: periodIds } } });
    }

    await prisma.pairing.deleteMany({ where: { organizationId } });
    await prisma.pairingPeriod.deleteMany({ where: { organizationId } });
    await prisma.userBlock.deleteMany({ where: { organizationId } });
    await prisma.algorithmSetting.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
  };

  const createOrganization = async (suffix = randomUUID().slice(0, 8)) => {
    const organization = await prisma.organization.create({
      data: {
        name: `E2E Org ${suffix}`,
        code: `e2e-${suffix}`,
      },
    });

    createdOrganizationIds.push(organization.id);
    return organization.id;
  };

  const createAuthenticatedUser = async (
    organizationId: string,
    role: UserRole,
    emailPrefix: string,
  ) => {
    const now = new Date();
    const supabaseUserId = randomUUID();
    const id = randomUUID();
    const user = await prisma.user.create({
      data: {
        id,
        organizationId,
        email: `${emailPrefix}-${supabaseUserId.slice(0, 8)}@example.com`,
        emailVerified: true,
        firstName: emailPrefix,
        lastName: "Tester",
        createdAt: now,
        updatedAt: now,
        role,
        profileStatus: ProfileStatus.active,
        isActive: true,
        supabaseUserId,
      },
    });

    const token = sign(
      {
        sub: supabaseUserId,
        email: user.email,
        role,
      },
      jwtSecret(),
      {
        algorithm: "HS256",
      },
    );

    return { user, token };
  };

  const resetBaseOrganizationState = async () => {
    if (!testOrgId) {
      return;
    }

    await prisma.pairing.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.pairingPeriod.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.userBlock.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.algorithmSetting.deleteMany({ where: { organizationId: testOrgId } });

    const persistentIds = [adminUserId, regularUserId].filter(Boolean) as string[];

    await prisma.user.deleteMany({
      where: {
        organizationId: testOrgId,
        id: { notIn: persistentIds },
      },
    });
  };

  const ensureAlgorithmSettings = async (
    organizationId: string,
    overrides: Partial<{ periodLengthDays: number; randomSeed: number }> = {},
  ) => {
    const { periodLengthDays = 21, randomSeed = 12345 } = overrides;

    await prisma.algorithmSetting.upsert({
      where: { organizationId },
      update: { periodLengthDays, randomSeed },
      create: {
        organizationId,
        periodLengthDays,
        randomSeed,
      },
    });
  };

  const createMembers = async (organizationId: string, count: number) => {
    const now = new Date();
    const suffix = randomUUID().slice(0, 8);
    const created: string[] = [];

    for (let index = 0; index < count; index += 1) {
      const user = await prisma.user.create({
        data: {
          id: randomUUID(),
          organizationId,
          email: `member-${suffix}-${index}@example.com`,
          emailVerified: true,
          firstName: `Member${index + 1}`,
          lastName: "E2E",
          createdAt: now,
          updatedAt: now,
          role: UserRole.user,
          profileStatus: ProfileStatus.active,
          isActive: true,
        },
      });

      created.push(user.id);
    }

    return created;
  };

  const createOrgWithAdmin = async (userCount: number) => {
    const organizationId = await createOrganization();
    const { user: admin, token } = await createAuthenticatedUser(
      organizationId,
      UserRole.org_admin,
      "admin",
    );

    if (userCount > 1) {
      await createMembers(organizationId, userCount - 1);
    }

    await ensureAlgorithmSettings(organizationId);
    return { organizationId, adminToken: token, adminUserId: admin.id };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PairingAlgorithmService)
      .useClass(E2EPairingAlgorithmService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    config = app.get(Config);

    testOrgId = await createOrganization("primary");
    const adminResult = await createAuthenticatedUser(
      testOrgId,
      UserRole.org_admin,
      "admin",
    );
    adminToken = adminResult.token;
    adminUserId = adminResult.user.id;

    const userResult = await createAuthenticatedUser(
      testOrgId,
      UserRole.user,
      "member",
    );
    userToken = userResult.token;
    regularUserId = userResult.user.id;
  });

  beforeEach(async () => {
    await resetBaseOrganizationState();
  });

  afterAll(async () => {
    for (const organizationId of [...createdOrganizationIds].reverse()) {
      await cleanupOrganization(organizationId).catch(() => undefined);
    }

    await app.close();
  });

  describe("Algorithm Settings Management", () => {
    it("should allow admin to update algorithm settings", async () => {
      const mutation = `
        mutation UpdateSettings($input: UpdateAlgorithmSettingsInput!) {
          updateAlgorithmSettings(input: $input) {
            organizationId
            periodLengthDays
            randomSeed
            warning
          }
        }
      `;

      const response = await graphql(adminToken).send({
        query: mutation,
        variables: {
          input: {
            organizationId: testOrgId,
            periodLengthDays: 14,
            randomSeed: 12345,
          },
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.updateAlgorithmSettings).toMatchObject({
        organizationId: testOrgId,
        periodLengthDays: 14,
        randomSeed: 12345,
        warning: null,
      });
    });

    it("should return warning for inefficient period length", async () => {
      const mutation = `
        mutation UpdateSettings($input: UpdateAlgorithmSettingsInput!) {
          updateAlgorithmSettings(input: $input) {
            periodLengthDays
            warning
          }
        }
      `;

      const shortResponse = await graphql(adminToken).send({
        query: mutation,
        variables: {
          input: {
            organizationId: testOrgId,
            periodLengthDays: 3,
            randomSeed: 12345,
          },
        },
      });

      expect(shortResponse.status).toBe(200);
      expect(shortResponse.body.errors).toBeUndefined();
      expect(shortResponse.body.data.updateAlgorithmSettings.warning).toBe(
        "Recommended pairing period is between 7 and 365 days.",
      );

      const longResponse = await graphql(adminToken).send({
        query: mutation,
        variables: {
          input: {
            organizationId: testOrgId,
            periodLengthDays: 400,
            randomSeed: 12345,
          },
        },
      });

      expect(longResponse.status).toBe(200);
      expect(longResponse.body.errors).toBeUndefined();
      expect(longResponse.body.data.updateAlgorithmSettings.warning).toBe(
        "Recommended pairing period is between 7 and 365 days.",
      );
    });

    it("should prevent non-admin from updating settings", async () => {
      const mutation = `
        mutation UpdateSettings($input: UpdateAlgorithmSettingsInput!) {
          updateAlgorithmSettings(input: $input) {
            id
          }
        }
      `;

      const response = await graphql(userToken).send({
        query: mutation,
        variables: {
          input: {
            organizationId: testOrgId,
            periodLengthDays: 14,
          },
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain("Insufficient permissions");
    });

    it("should fetch current algorithm settings", async () => {
      await ensureAlgorithmSettings(testOrgId, { periodLengthDays: 21, randomSeed: 9999 });

      const query = `
        query GetSettings($organizationId: String!) {
          getAlgorithmSettings(organizationId: $organizationId) {
            id
            periodLengthDays
            randomSeed
          }
        }
      `;

      const response = await graphql(adminToken).send({
        query,
        variables: { organizationId: testOrgId },
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.getAlgorithmSettings).toMatchObject({
        periodLengthDays: 21,
        randomSeed: 9999,
      });
    });
  });

  describe("Pairing Execution", () => {
    it("should allow admin to execute pairing manually", async () => {
      await ensureAlgorithmSettings(testOrgId, { periodLengthDays: 21, randomSeed: 54321 });
      await createMembers(testOrgId, 6);

      const mutation = `
        mutation ExecutePairing($organizationId: String!) {
          executePairingAlgorithm(organizationId: $organizationId) {
            success
            pairingsCreated
            message
            unpairedUsers
          }
        }
      `;

      const response = await graphql(adminToken).send({
        query: mutation,
        variables: { organizationId: testOrgId },
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.executePairingAlgorithm).toMatchObject({
        success: true,
      });
      expect(response.body.data.executePairingAlgorithm.pairingsCreated).toBeGreaterThan(0);

      const pairingCount = await prisma.pairing.count({ where: { organizationId: testOrgId } });
      expect(pairingCount).toBe(response.body.data.executePairingAlgorithm.pairingsCreated);
    });

    it("should prevent non-admin from executing pairing", async () => {
      await ensureAlgorithmSettings(testOrgId);

      const mutation = `
        mutation ExecutePairing($organizationId: String!) {
          executePairingAlgorithm(organizationId: $organizationId) {
            success
          }
        }
      `;

      const response = await graphql(userToken).send({
        query: mutation,
        variables: { organizationId: testOrgId },
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain(
        "You do not have permission to execute the pairing algorithm",
      );
    });

    it("should return error when not enough users", async () => {
      const { organizationId, adminToken: smallOrgToken } = await createOrgWithAdmin(1);

      const mutation = `
        mutation ExecutePairing($organizationId: String!) {
          executePairingAlgorithm(organizationId: $organizationId) {
            success
            message
          }
        }
      `;

      const response = await graphql(smallOrgToken).send({
        query: mutation,
        variables: { organizationId },
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toBe("Failed to execute pairing algorithm");
      expect(response.body.errors[0].extensions?.details).toContain("Not enough users");
    });
  });

  describe("Complete Workflow", () => {
    it("should complete full admin workflow: settings -> execute -> verify", async () => {
      await createMembers(testOrgId, 6);

      const updateSettingsMutation = `
        mutation UpdateSettings($input: UpdateAlgorithmSettingsInput!) {
          updateAlgorithmSettings(input: $input) {
            periodLengthDays
            randomSeed
          }
        }
      `;

      await graphql(adminToken)
        .send({
          query: updateSettingsMutation,
          variables: {
            input: {
              organizationId: testOrgId,
              periodLengthDays: 21,
              randomSeed: 99999,
            },
          },
        })
        .expect(200);

      const executeMutation = `
        mutation ExecutePairing($organizationId: String!) {
          executePairingAlgorithm(organizationId: $organizationId) {
            success
            pairingsCreated
          }
        }
      `;

      const pairingResponse = await graphql(adminToken).send({
        query: executeMutation,
        variables: { organizationId: testOrgId },
      });

      expect(pairingResponse.status).toBe(200);
      expect(pairingResponse.body.errors).toBeUndefined();
      expect(pairingResponse.body.data.executePairingAlgorithm.success).toBe(true);

      const pairings = await prisma.pairing.findMany({ where: { organizationId: testOrgId } });
      expect(pairings.length).toBeGreaterThan(0);
      expect(pairings[0].status).toBe(PairingStatus.planned);

      const period = await prisma.pairingPeriod.findFirst({
        where: { organizationId: testOrgId },
        orderBy: { createdAt: "desc" },
        include: { pairings: true },
      });

      expect(period).toBeDefined();
      expect(period?.pairings.length).toBe(pairingResponse.body.data.executePairingAlgorithm.pairingsCreated);
    });
  });
});
