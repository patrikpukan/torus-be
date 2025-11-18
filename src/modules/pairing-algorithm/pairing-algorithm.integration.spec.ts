import { Test, TestingModule } from '@nestjs/testing';
import { PairingStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PairingAlgorithmModule } from './pairing-algorithm.module';
import { PairingAlgorithmService } from './pairing-algorithm.service';
import { PrismaService } from '../../core/prisma/prisma.service';

const createTimestamp = () => new Date();

const collectUniqueValues = <T>(values: T[]): Set<T> => new Set(values);

describe('PairingAlgorithm Integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let service: PairingAlgorithmService;
  let currentOrgId: string | undefined;

  const cleanupOrganization = async (organizationId: string): Promise<void> => {
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
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  };

  const createOrganization = async (): Promise<string> => {
    const organization = await prisma.organization.create({
      data: {
        name: `Pairing Test Org ${Date.now()}`,
        code: `pairing-test-${randomUUID().slice(0, 8)}`,
      },
    });

    return organization.id;
  };

  const createUsers = async (organizationId: string, count: number) => {
    const timestamp = createTimestamp();
    const suffix = randomUUID().slice(0, 8);
    const users = [] as Array<{ id: string; email: string }>;

    for (let index = 0; index < count; index += 1) {
      const user = await prisma.user.create({
        data: {
          id: randomUUID(),
          organizationId,
          email: `pairing-user-${index}-${suffix}@example.com`,
          emailVerified: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          firstName: `User${index + 1}`,
          lastName: 'Integration',
        },
      });

      users.push({ id: user.id, email: user.email });
    }

    return users;
  };

  const ensureAlgorithmSettings = async (
    organizationId: string,
    overrides: Partial<{ periodLengthDays: number; randomSeed: number }> = {},
  ) => {
    const { periodLengthDays = 21, randomSeed = 12345 } = overrides;

    await prisma.algorithmSetting.create({
      data: {
        organizationId,
        periodLengthDays,
        randomSeed,
      },
    });
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PairingAlgorithmModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(PairingAlgorithmService);

    await prisma.$connect();
  });

  afterAll(async () => {
    if (currentOrgId) {
      await cleanupOrganization(currentOrgId);
      currentOrgId = undefined;
    }

    await prisma.$disconnect();
    await moduleRef.close();
  });

  beforeEach(async () => {
    if (currentOrgId) {
      await cleanupOrganization(currentOrgId);
    }

    currentOrgId = await createOrganization();
  });

  afterEach(async () => {
    if (currentOrgId) {
      await cleanupOrganization(currentOrgId);
      currentOrgId = undefined;
    }
  });

  it('should complete full pairing cycle for 6 users', async () => {
    if (!currentOrgId) {
      throw new Error('Test organization was not initialized');
    }

    const users = await createUsers(currentOrgId, 6);
    await ensureAlgorithmSettings(currentOrgId, { periodLengthDays: 21, randomSeed: 12345 });

    await service.executePairing(currentOrgId);

    const pairingPeriod = await prisma.pairingPeriod.findFirst({
      where: { organizationId: currentOrgId },
      include: { pairings: true },
      orderBy: { createdAt: 'desc' },
    });

    expect(pairingPeriod).toBeDefined();
    expect(pairingPeriod?.pairings.length).toBe(3);

    const pairings = await prisma.pairing.findMany({ where: { organizationId: currentOrgId } });
    expect(pairings).toHaveLength(3);

    pairings.forEach((pairing) => {
      expect(pairing.status).toBe(PairingStatus.planned);
      expect(pairing.periodId).toBe(pairingPeriod?.id);
    });

    const pairedUserIds = collectUniqueValues(
      pairings.flatMap((pair) => [pair.userAId, pair.userBId]),
    );
    expect(pairedUserIds.size).toBe(users.length);
  });

  it('should respect blocking constraints', async () => {
    if (!currentOrgId) {
      throw new Error('Test organization was not initialized');
    }

    const [userOne, userTwo, userThree, userFour] = await createUsers(currentOrgId, 4);
    await ensureAlgorithmSettings(currentOrgId, { periodLengthDays: 21, randomSeed: 54321 });

    await prisma.userBlock.create({
      data: {
        organizationId: currentOrgId,
        blockerId: userOne.id,
        blockedId: userTwo.id,
      },
    });

    await service.executePairing(currentOrgId);

    const pairings = await prisma.pairing.findMany({ where: { organizationId: currentOrgId } });
    expect(pairings.length).toBeGreaterThanOrEqual(1);

    const blockedPairExists = pairings.some((pairing) => {
      const participants = collectUniqueValues([pairing.userAId, pairing.userBId]);
      return participants.has(userOne.id) && participants.has(userTwo.id);
    });

    expect(blockedPairExists).toBe(false);

    const pairedUserIds = collectUniqueValues(
      pairings.flatMap((pair) => [pair.userAId, pair.userBId]),
    );

    expect(pairedUserIds.size).toBeGreaterThanOrEqual(2);
    expect(pairedUserIds.has(userThree.id)).toBe(true);
    expect(pairedUserIds.has(userFour.id)).toBe(true);
  });
});
