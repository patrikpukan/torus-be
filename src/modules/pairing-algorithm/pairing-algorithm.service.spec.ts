import { Test, TestingModule } from "@nestjs/testing";
import { PairingPeriodStatus } from "@prisma/client";
import {
  InsufficientUsersException,
  PairingAlgorithmService,
  PairingConstraintException,
} from "./pairing-algorithm.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { AppLoggerService } from "../../shared/logger/logger.service";
import { PairingAlgorithmConfig } from "./pairing-algorithm.config";

describe("PairingAlgorithmService helpers", () => {
  let service: PairingAlgorithmService;
  let userFindMany: jest.Mock;
  let userBlockFindMany: jest.Mock;
  let pairingFindMany: jest.Mock;
  let pairingPeriodFindUnique: jest.Mock;
  let pairingPeriodFindFirst: jest.Mock;
  let pairingPeriodFindMany: jest.Mock;
  let pairingPeriodCreate: jest.Mock;
  let pairingCreateMany: jest.Mock;
  let organizationFindUnique: jest.Mock;
  let algorithmSettingFindUnique: jest.Mock;
  let algorithmSettingCreate: jest.Mock;
  let algorithmSettingUpdate: jest.Mock;
  let prismaTransaction: jest.Mock;
  let logger: {
    log: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
  };

  beforeEach(async () => {
    userFindMany = jest.fn();
    userBlockFindMany = jest.fn();
    pairingFindMany = jest.fn();
    pairingPeriodFindUnique = jest.fn();
    pairingPeriodFindFirst = jest.fn();
    pairingPeriodFindMany = jest.fn();
    pairingPeriodCreate = jest.fn();
    pairingCreateMany = jest.fn();
    organizationFindUnique = jest.fn();
    algorithmSettingFindUnique = jest.fn();
    algorithmSettingCreate = jest.fn();
    algorithmSettingUpdate = jest.fn();
    prismaTransaction = jest.fn();
    logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PairingAlgorithmService,
        {
          provide: PrismaService,
          useValue: {
            user: { findMany: userFindMany },
            userBlock: { findMany: userBlockFindMany },
            pairing: {
              findMany: pairingFindMany,
              createMany: pairingCreateMany,
            },
            pairingPeriod: {
              findUnique: pairingPeriodFindUnique,
              findFirst: pairingPeriodFindFirst,
              findMany: pairingPeriodFindMany,
              create: pairingPeriodCreate,
            },
            organization: { findUnique: organizationFindUnique },
            algorithmSetting: {
              findUnique: algorithmSettingFindUnique,
              create: algorithmSettingCreate,
              update: algorithmSettingUpdate,
            },
            $transaction: prismaTransaction,
          },
        },
        {
          provide: AppLoggerService,
          useValue: logger,
        },
        {
          provide: PairingAlgorithmConfig,
          useValue: {
            cronEnabled: true,
            cronSchedule: "0 0 * * 1",
            defaultPeriodDays: 21,
            minPeriodDays: 7,
            maxPeriodDays: 365,
          } as PairingAlgorithmConfig,
        },
      ],
    }).compile();

    service = moduleRef.get(PairingAlgorithmService);

    prismaTransaction.mockImplementation(async (callback: any) => {
      return callback({ pairing: { createMany: pairingCreateMany } });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("canBePaired", () => {
    it("should return true when users have no blocks or recent history", () => {
      expect(
        (service as any).canBePaired(
          "user-a",
          "user-b",
          new Set(),
          new Set(),
          new Map(),
          new Map(),
          4
        )
      ).toBe(true);
    });

    it("should return false when userA blocks userB", () => {
      expect(
        (service as any).canBePaired(
          "user-a",
          "user-b",
          new Set(["user-b"]),
          new Set(),
          new Map(),
          new Map(),
          4
        )
      ).toBe(false);
    });

    it("should return false when userB blocks userA", () => {
      expect(
        (service as any).canBePaired(
          "user-a",
          "user-b",
          new Set(),
          new Set(["user-a"]),
          new Map(),
          new Map(),
          4
        )
      ).toBe(false);
    });

    it("should return false when paired in last period", () => {
      expect(
        (service as any).canBePaired(
          "user-a",
          "user-b",
          new Set(),
          new Set(),
          new Map([["user-b", 1]]),
          new Map(),
          4
        )
      ).toBe(false);
    });

    it("should return false when paired in last 2 periods", () => {
      expect(
        (service as any).canBePaired(
          "user-a",
          "user-b",
          new Set(),
          new Set(),
          new Map([["user-b", 2]]),
          new Map(),
          4
        )
      ).toBe(false);
    });

    it("should return true when paired recently but only two users exist", () => {
      expect(
        (service as any).canBePaired(
          "user-a",
          "user-b",
          new Set(),
          new Set(),
          new Map([["user-b", 1]]),
          new Map(),
          2
        )
      ).toBe(true);
    });
  });

  describe("getUserBlocks", () => {
    it("should return empty set when user has no blocks", async () => {
      userBlockFindMany.mockResolvedValueOnce([]);

      const result = await (service as any).getUserBlocks("user-a");

      expect(result.size).toBe(0);
      expect(userBlockFindMany).toHaveBeenCalledWith({
        select: { blockerId: true, blockedId: true },
        where: { OR: [{ blockerId: "user-a" }, { blockedId: "user-a" }] },
      });
    });

    it("should return users blocked by this user", async () => {
      userBlockFindMany.mockResolvedValueOnce([
        { blockerId: "user-a", blockedId: "user-b" },
      ] as any);

      const result = await (service as any).getUserBlocks("user-a");

      expect(Array.from(result)).toEqual(["user-b"]);
    });

    it("should return users who blocked this user", async () => {
      userBlockFindMany.mockResolvedValueOnce([
        { blockerId: "user-c", blockedId: "user-a" },
      ] as any);

      const result = await (service as any).getUserBlocks("user-a");

      expect(Array.from(result)).toEqual(["user-c"]);
    });

    it("should return both directions (bidirectional blocking)", async () => {
      userBlockFindMany.mockResolvedValueOnce([
        { blockerId: "user-a", blockedId: "user-b" },
        { blockerId: "user-c", blockedId: "user-a" },
      ] as any);

      const result = await (service as any).getUserBlocks("user-a");

      expect(new Set(result)).toEqual(new Set(["user-b", "user-c"]));
    });
  });

  describe("getNewUsers", () => {
    it("should return users with no pairing history", async () => {
      userFindMany.mockResolvedValueOnce([
        { id: "user-1" },
        { id: "user-2" },
      ] as any);

      const result = await (service as any).getNewUsers("org-1");

      expect(result).toEqual(["user-1", "user-2"]);
      expect(userFindMany).toHaveBeenCalledWith({
        select: { id: true },
        where: {
          organizationId: "org-1",
          pairingsAsUserA: { none: {} },
          pairingsAsUserB: { none: {} },
        },
      });
    });

    it("should return empty array when all users have history", async () => {
      userFindMany.mockResolvedValueOnce([]);

      const result = await (service as any).getNewUsers("org-1");

      expect(result).toEqual([]);
    });
  });

  describe("getUnpairedFromLastPeriod", () => {
    it("should return users who were eligible but not paired", async () => {
      pairingPeriodFindUnique.mockResolvedValueOnce({
        startDate: new Date("2024-03-01"),
      } as any);
      pairingPeriodFindFirst.mockResolvedValueOnce({ id: "period-1" } as any);
      userFindMany.mockResolvedValueOnce([
        { id: "user-1" },
        { id: "user-2" },
        { id: "user-3" },
      ] as any);
      pairingFindMany.mockResolvedValueOnce([
        { userAId: "user-1", userBId: "user-2" },
      ] as any);

      const result = await (service as any).getUnpairedFromLastPeriod(
        "org-1",
        "period-2"
      );

      expect(result).toEqual(["user-3"]);
    });

    it("should return empty array when no previous period exists", async () => {
      pairingPeriodFindUnique.mockResolvedValueOnce({
        startDate: new Date("2024-03-01"),
      } as any);
      pairingPeriodFindFirst.mockResolvedValueOnce(null);

      const result = await (service as any).getUnpairedFromLastPeriod(
        "org-1",
        "period-2"
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when all were paired last time", async () => {
      pairingPeriodFindUnique.mockResolvedValueOnce({
        startDate: new Date("2024-03-01"),
      } as any);
      pairingPeriodFindFirst.mockResolvedValueOnce({ id: "period-1" } as any);
      userFindMany.mockResolvedValueOnce([
        { id: "user-1" },
        { id: "user-2" },
      ] as any);
      pairingFindMany.mockResolvedValueOnce([
        { userAId: "user-1", userBId: "user-2" },
      ] as any);

      const result = await (service as any).getUnpairedFromLastPeriod(
        "org-1",
        "period-2"
      );

      expect(result).toEqual([]);
    });
  });

  describe("getEligibleUsers", () => {
    it("should return only active users", async () => {
      userFindMany.mockResolvedValueOnce([
        { id: "user-1", isActive: true },
        { id: "user-2", isActive: true },
      ] as any);

      const result = await (service as any).getEligibleUsers(
        "org-1",
        "period-1"
      );

      expect(result).toEqual([
        { id: "user-1", isActive: true },
        { id: "user-2", isActive: true },
      ]);
      expect(userFindMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          isActive: true,
          OR: [
            { suspendedUntil: null },
            { suspendedUntil: { lt: expect.any(Date) } },
          ],
          pairingsAsUserA: { none: { periodId: "period-1" } },
          pairingsAsUserB: { none: { periodId: "period-1" } },
        },
      });
    });

    it("should exclude suspended users", async () => {
      userFindMany.mockResolvedValueOnce([]);

      await (service as any).getEligibleUsers("org-1", "period-1");

      expect(userFindMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          isActive: true,
          OR: [
            { suspendedUntil: null },
            { suspendedUntil: { lt: expect.any(Date) } },
          ],
          pairingsAsUserA: { none: { periodId: "period-1" } },
          pairingsAsUserB: { none: { periodId: "period-1" } },
        },
      });
    });

    it("should exclude users already paired in current period", async () => {
      userFindMany.mockResolvedValueOnce([
        { id: "user-1" },
        { id: "user-4" },
      ] as any);

      const result = await (service as any).getEligibleUsers(
        "org-1",
        "period-1"
      );

      expect(result).toEqual([{ id: "user-1" }, { id: "user-4" }]);
    });
  });
});

describe("PairingAlgorithmService executePairing", () => {
  let service: PairingAlgorithmService;
  let pairingCreateMany: jest.Mock;
  let pairingFindMany: jest.Mock;
  let pairingPeriodFindFirst: jest.Mock;
  let pairingPeriodFindMany: jest.Mock;
  let pairingPeriodCreate: jest.Mock;
  let organizationFindUnique: jest.Mock;
  let algorithmSettingFindUnique: jest.Mock;
  let algorithmSettingCreate: jest.Mock;
  let algorithmSettingUpdate: jest.Mock;
  let prismaTransaction: jest.Mock;
  let logger: {
    log: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PairingAlgorithmService,
        {
          provide: PrismaService,
          useFactory: () => {
            pairingCreateMany = jest.fn();
            pairingFindMany = jest.fn();
            pairingPeriodFindFirst = jest.fn();
            pairingPeriodFindMany = jest.fn();
            pairingPeriodCreate = jest.fn();
            organizationFindUnique = jest.fn();
            algorithmSettingFindUnique = jest.fn();
            algorithmSettingCreate = jest.fn();
            algorithmSettingUpdate = jest.fn();
            prismaTransaction = jest.fn();

            return {
              pairing: {
                findMany: pairingFindMany,
                createMany: pairingCreateMany,
              },
              pairingPeriod: {
                findFirst: pairingPeriodFindFirst,
                findMany: pairingPeriodFindMany,
                create: pairingPeriodCreate,
              },
              organization: { findUnique: organizationFindUnique },
              algorithmSetting: {
                findUnique: algorithmSettingFindUnique,
                create: algorithmSettingCreate,
                update: algorithmSettingUpdate,
              },
              user: { findMany: jest.fn() },
              userBlock: { findMany: jest.fn() },
              $transaction: prismaTransaction,
            } as unknown as PrismaService;
          },
        },
        {
          provide: AppLoggerService,
          useFactory: () => {
            logger = {
              log: jest.fn(),
              error: jest.fn(),
              warn: jest.fn(),
              debug: jest.fn(),
            };
            return logger;
          },
        },
        {
          provide: PairingAlgorithmConfig,
          useValue: {
            cronEnabled: true,
            cronSchedule: "0 0 * * 1",
            defaultPeriodDays: 21,
            minPeriodDays: 7,
            maxPeriodDays: 365,
          } as PairingAlgorithmConfig,
        },
      ],
    }).compile();

    service = moduleRef.get(PairingAlgorithmService);

    prismaTransaction.mockImplementation(async (callback: any) => {
      return callback({ pairing: { createMany: pairingCreateMany } });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const helperSpies: jest.SpyInstance[] = [];

  const registerHelperSpy = (spy: jest.SpyInstance) => {
    helperSpies.push(spy);
    return spy;
  };

  const mockHelpers = (config: {
    eligibleUsers: Array<{ id: string }>;
    newUsers?: string[];
    unpairedLastPeriod?: string[];
    userBlocks?: Record<string, string[]>;
    userHistory?: Record<string, Map<string, number>>;
    shuffleMode?: "identity" | "actual" | ((items: any[], random: any) => void);
    trySwapPairsImplementation?: jest.Mock | ((...args: any[]) => boolean);
    canBePairedImplementation?: (...args: any[]) => boolean;
  }) => {
    const {
      eligibleUsers,
      newUsers = [],
      unpairedLastPeriod = [],
      userBlocks = {},
      userHistory = {},
      shuffleMode = "identity",
      trySwapPairsImplementation,
      canBePairedImplementation,
    } = config;

    registerHelperSpy(
      jest
        .spyOn(service as any, "getEligibleUsers")
        .mockResolvedValue(eligibleUsers)
    );
    registerHelperSpy(
      jest.spyOn(service as any, "getNewUsers").mockResolvedValue(newUsers)
    );
    registerHelperSpy(
      jest
        .spyOn(service as any, "getUnpairedFromLastPeriod")
        .mockResolvedValue(unpairedLastPeriod)
    );
    registerHelperSpy(
      jest
        .spyOn(service as any, "getUserBlocks")
        .mockImplementation(async (userId: string) => {
          return new Set(userBlocks[userId] ?? []);
        })
    );
    registerHelperSpy(
      jest
        .spyOn(service as any, "getUserPairingHistory")
        .mockImplementation(async (userId: string) => {
          return userHistory[userId] ?? new Map<string, number>();
        })
    );

    const originalShuffle = (service as any).shuffleInPlace;
    if (typeof shuffleMode === "function") {
      registerHelperSpy(
        jest
          .spyOn(service as any, "shuffleInPlace")
          .mockImplementation(shuffleMode)
      );
    } else if (shuffleMode === "actual") {
      registerHelperSpy(
        jest
          .spyOn(service as any, "shuffleInPlace")
          .mockImplementation(function (
            this: unknown,
            items: any[],
            random: any
          ) {
            return originalShuffle.apply(this, [items, random]);
          })
      );
    } else {
      registerHelperSpy(
        jest
          .spyOn(service as any, "shuffleInPlace")
          .mockImplementation((items: any[]) => items)
      );
    }

    const originalTrySwapPairs = (service as any).trySwapPairs;
    if (trySwapPairsImplementation) {
      registerHelperSpy(
        jest
          .spyOn(service as any, "trySwapPairs")
          .mockImplementation(trySwapPairsImplementation as any)
      );
    } else {
      registerHelperSpy(
        jest.spyOn(service as any, "trySwapPairs").mockImplementation(function (
          this: unknown,
          ...args: any[]
        ) {
          return originalTrySwapPairs.apply(this, args as any);
        })
      );
    }

    const originalCanBePaired = (service as any).canBePaired;
    registerHelperSpy(
      jest.spyOn(service as any, "canBePaired").mockImplementation(function (
        this: unknown,
        ...args: any[]
      ) {
        if (canBePairedImplementation) {
          return canBePairedImplementation.apply(this, args as any);
        }

        return originalCanBePaired.apply(this, args as any);
      })
    );
  };

  afterEach(() => {
    helperSpies.splice(0).forEach((spy) => spy.mockRestore());
  });

  const configurePrismaBase = (config?: {
    algorithmSettings?: {
      organizationId: string;
      periodLengthDays: number;
      randomSeed: number;
    };
    pairingPeriod?: { id: string; startDate: Date; endDate: Date };
    previousPeriods?: Array<{ id: string }>;
  }) => {
    const algorithmSettings = config?.algorithmSettings ?? {
      organizationId: "org-1",
      periodLengthDays: 21,
      randomSeed: 12345,
    };

    organizationFindUnique.mockResolvedValue({ id: "org-1" });
    algorithmSettingFindUnique.mockResolvedValue(algorithmSettings);
    algorithmSettingCreate.mockResolvedValue(algorithmSettings);
    algorithmSettingUpdate.mockImplementation(async ({ data }: any) => ({
      ...algorithmSettings,
      ...data,
    }));

    const startDate = new Date("2025-10-01T00:00:00.000Z");
    const defaultPeriod = config?.pairingPeriod ?? {
      id: "period-current",
      startDate,
      endDate: new Date(startDate.getTime() + 21 * 24 * 60 * 60 * 1000),
    };

    pairingPeriodFindFirst.mockResolvedValue(defaultPeriod);
    pairingPeriodCreate.mockImplementation(async ({ data }: any) => ({
      id: "period-created",
      ...data,
    }));
    pairingPeriodFindMany.mockResolvedValue(config?.previousPeriods ?? []);

    pairingFindMany.mockImplementation(async () => []);
    pairingCreateMany.mockResolvedValue({ count: 0 });
  };

  const captureCreatedPairs = () => {
    let pairs: Array<{ userAId: string; userBId: string }> = [];
    pairingCreateMany.mockImplementation(async ({ data }: any) => {
      pairs = data;
      return { count: data.length };
    });
    return () => pairs;
  };

  const expectUsersPaired = (
    pairs: Array<{ userAId: string; userBId: string }>,
    expected: string[]
  ) => {
    const pairedUsers = new Set(
      pairs.flatMap((pair) => [pair.userAId, pair.userBId])
    );
    expect(pairedUsers).toEqual(new Set(expected));
  };

  describe("executePairing - basic scenarios", () => {
    it("should create 2 pairs for 4 users with no constraints", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [
          { id: "user-1" },
          { id: "user-2" },
          { id: "user-3" },
          { id: "user-4" },
        ],
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      expect(pairingCreateMany).toHaveBeenCalledTimes(1);
      expect(pairs).toHaveLength(2);
      expectUsersPaired(pairs, ["user-1", "user-2", "user-3", "user-4"]);
    });

    it("should create 2 pairs and leave 1 unpaired for 5 users", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [
          { id: "user-1" },
          { id: "user-2" },
          { id: "user-3" },
          { id: "user-4" },
          { id: "user-5" },
        ],
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      expect(pairingCreateMany).toHaveBeenCalledTimes(1);
      expect(pairs).toHaveLength(2);
      expectUsersPaired(pairs, ["user-1", "user-2", "user-3", "user-4"]);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("user-5"),
        PairingAlgorithmService.name
      );
    });

    it("should create 1 pair for 2 users (minimum)", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [{ id: "user-1" }, { id: "user-2" }],
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      expect(pairingCreateMany).toHaveBeenCalledTimes(1);
      expect(pairs).toEqual([
        expect.objectContaining({ userAId: "user-1", userBId: "user-2" }),
      ]);
    });
  });

  describe("executePairing - guaranteed users", () => {
    it("should pair new users first (guaranteed)", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [
          { id: "user-new-1" },
          { id: "user-new-2" },
          { id: "user-3" },
          { id: "user-4" },
          { id: "user-5" },
          { id: "user-6" },
        ],
        newUsers: ["user-new-1", "user-new-2"],
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      const newUserPair = pairs.find(
        (pair) =>
          ["user-new-1", "user-new-2"].includes(pair.userAId) &&
          ["user-new-1", "user-new-2"].includes(pair.userBId)
      );

      expect(newUserPair).toBeDefined();
      expect(newUserPair?.userAId).not.toEqual(newUserPair?.userBId);
    });

    it("should pair users unpaired from last period (guaranteed)", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [
          { id: "user-unpaired" },
          { id: "user-2" },
          { id: "user-3" },
          { id: "user-4" },
          { id: "user-5" },
          { id: "user-6" },
        ],
        unpairedLastPeriod: ["user-unpaired"],
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      const wasPaired = pairs.some(
        (pair) =>
          pair.userAId === "user-unpaired" || pair.userBId === "user-unpaired"
      );

      expect(wasPaired).toBe(true);
    });

    it("should prioritize both new AND unpaired users", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [
          { id: "user-new" },
          { id: "user-unpaired" },
          { id: "user-3" },
          { id: "user-4" },
          { id: "user-5" },
          { id: "user-6" },
        ],
        newUsers: ["user-new"],
        unpairedLastPeriod: ["user-unpaired"],
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      const guaranteedPair = pairs.find(
        (pair) =>
          [pair.userAId, pair.userBId].includes("user-new") &&
          [pair.userAId, pair.userBId].includes("user-unpaired")
      );

      expect(guaranteedPair).toBeDefined();
    });
  });

  describe("executePairing - blocking", () => {
    it("should not pair blocked users together", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [
          { id: "user-a" },
          { id: "user-b" },
          { id: "user-c" },
          { id: "user-d" },
        ],
        userBlocks: {
          "user-a": ["user-b"],
          "user-b": [],
          "user-c": [],
          "user-d": [],
        },
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      const containsBlockedPair = pairs.some(
        (pair) =>
          (pair.userAId === "user-a" && pair.userBId === "user-b") ||
          (pair.userAId === "user-b" && pair.userBId === "user-a")
      );

      expect(containsBlockedPair).toBe(false);
    });

    it("should handle bidirectional blocking", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [
          { id: "user-a" },
          { id: "user-b" },
          { id: "user-c" },
          { id: "user-d" },
        ],
        userBlocks: {
          "user-a": ["user-b"],
          "user-b": ["user-a"],
          "user-c": [],
          "user-d": [],
        },
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      const blockedTogether = pairs.some(
        (pair) =>
          [pair.userAId, pair.userBId].includes("user-a") &&
          [pair.userAId, pair.userBId].includes("user-b")
      );

      expect(blockedTogether).toBe(false);
    });

    it("should leave user unpaired if all partners are blocked", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [{ id: "user-a" }, { id: "user-b" }, { id: "user-c" }],
        userBlocks: {
          "user-a": ["user-b", "user-c"],
          "user-b": [],
          "user-c": [],
        },
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      expectUsersPaired(pairs, ["user-b", "user-c"]);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("user-a"),
        PairingAlgorithmService.name
      );
    });
  });

  describe("executePairing - history constraints", () => {
    it("should avoid pairing users paired in last period", async () => {
      configurePrismaBase({
        previousPeriods: [{ id: "period-last" }],
      });

      pairingFindMany.mockImplementation(async ({ where }: any) => {
        if (where?.periodId === "period-last") {
          return [
            { userAId: "user-a", userBId: "user-b" },
            { userAId: "user-c", userBId: "user-d" },
          ];
        }
        return [];
      });

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [
          { id: "user-a" },
          { id: "user-b" },
          { id: "user-c" },
          { id: "user-d" },
        ],
        userBlocks: {
          "user-a": [],
          "user-b": [],
          "user-c": [],
          "user-d": [],
        },
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      const lastPeriodPairExists = pairs.some(
        (pair) =>
          (pair.userAId === "user-a" && pair.userBId === "user-b") ||
          (pair.userAId === "user-b" && pair.userBId === "user-a")
      );

      expect(lastPeriodPairExists).toBe(false);
    });

    it("should NEVER pair users paired in last 2 periods", async () => {
      configurePrismaBase({
        previousPeriods: [{ id: "period-last" }, { id: "period-second-last" }],
      });

      pairingFindMany.mockImplementation(async ({ where }: any) => {
        if (
          where?.periodId === "period-last" ||
          where?.periodId === "period-second-last"
        ) {
          return [{ userAId: "user-a", userBId: "user-b" }];
        }
        return [];
      });

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [
          { id: "user-a" },
          { id: "user-b" },
          { id: "user-c" },
          { id: "user-d" },
        ],
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      const bannedPairExists = pairs.some(
        (pair) =>
          [pair.userAId, pair.userBId].includes("user-a") &&
          [pair.userAId, pair.userBId].includes("user-b")
      );
      expect(bannedPairExists).toBe(false);
    });

    it("should allow 3x pairing when only 2 users exist", async () => {
      configurePrismaBase({
        previousPeriods: [{ id: "period-last" }, { id: "period-second-last" }],
      });

      pairingFindMany.mockImplementation(async ({ where }: any) => {
        if (
          where?.periodId === "period-last" ||
          where?.periodId === "period-second-last"
        ) {
          return [{ userAId: "user-a", userBId: "user-b" }];
        }
        return [];
      });

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [{ id: "user-a" }, { id: "user-b" }],
        shuffleMode: "actual",
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      expect(pairs).toHaveLength(1);
      expect(new Set([pairs[0].userAId, pairs[0].userBId])).toEqual(
        new Set(["user-a", "user-b"])
      );
    });
  });

  describe("executePairing - random seed", () => {
    it("should produce same pairs with same seed", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      const seed = 12345;
      algorithmSettingFindUnique.mockResolvedValue({
        organizationId: "org-1",
        periodLengthDays: 21,
        randomSeed: seed,
      });

      const runWithSeed = async () => {
        pairingCreateMany.mockClear();
        mockHelpers({
          eligibleUsers: [
            { id: "user-a" },
            { id: "user-b" },
            { id: "user-c" },
            { id: "user-d" },
          ],
          shuffleMode: "actual",
        });

        const collectPairs = captureCreatedPairs();
        await service.executePairing("org-1");
        helperSpies.splice(0).forEach((spy) => spy.mockRestore());
        return collectPairs().map(({ userAId, userBId }) => ({
          userAId,
          userBId,
        }));
      };

      const firstRun = await runWithSeed();
      const secondRun = await runWithSeed();

      expect(firstRun).toEqual(secondRun);
    });

    it("should produce different pairs with different seeds", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      const runWithSeed = async (seed: number) => {
        algorithmSettingFindUnique.mockResolvedValue({
          organizationId: "org-1",
          periodLengthDays: 21,
          randomSeed: seed,
        });

        pairingCreateMany.mockClear();
        mockHelpers({
          eligibleUsers: [
            { id: "user-a" },
            { id: "user-b" },
            { id: "user-c" },
            { id: "user-d" },
          ],
          shuffleMode: "actual",
        });

        const collectPairs = captureCreatedPairs();
        await service.executePairing("org-1");
        helperSpies.splice(0).forEach((spy) => spy.mockRestore());
        return collectPairs();
      };

      const firstRun = await runWithSeed(12345);
      const secondRun = await runWithSeed(67890);

      expect(firstRun).not.toEqual(secondRun);
    });
  });

  describe("executePairing - error handling", () => {
    it("should throw error when less than 2 users", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      mockHelpers({ eligibleUsers: [{ id: "user-only" }] });

      await expect(service.executePairing("org-1")).rejects.toThrow(
        InsufficientUsersException
      );
    });

    it("should throw error when organization not found", async () => {
      organizationFindUnique.mockResolvedValue(null);
      algorithmSettingFindUnique.mockResolvedValue({
        organizationId: "org-1",
        periodLengthDays: 21,
        randomSeed: 1,
      });

      mockHelpers({ eligibleUsers: [] });

      await expect(service.executePairing("org-missing")).rejects.toThrow(
        PairingConstraintException
      );
    });

    it("should throw error when settings not found", async () => {
      organizationFindUnique.mockResolvedValue({ id: "org-1" });
      algorithmSettingFindUnique.mockResolvedValue(null);
      algorithmSettingCreate.mockResolvedValue(null);

      mockHelpers({ eligibleUsers: [{ id: "user-1" }, { id: "user-2" }] });

      await expect(service.executePairing("org-1")).rejects.toThrow(
        PairingConstraintException
      );
    });

    it("should rollback on database error", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      const failure = new Error("DB failure");
      pairingCreateMany.mockRejectedValueOnce(failure);

      mockHelpers({
        eligibleUsers: [{ id: "user-a" }, { id: "user-b" }],
      });

      await expect(service.executePairing("org-1")).rejects.toThrow(
        "DB failure"
      );
      expect(pairingCreateMany).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("DB failure"),
        expect.any(String),
        PairingAlgorithmService.name
      );
    });
  });

  describe("executePairing - complex scenarios", () => {
    it("should handle mixed constraints (blocks + history + guarantees)", async () => {
      configurePrismaBase({
        previousPeriods: [{ id: "period-last" }, { id: "period-second-last" }],
      });

      pairingFindMany.mockImplementation(async ({ where }: any) => {
        if (where?.periodId === "period-last") {
          return [{ userAId: "user-1", userBId: "user-4" }];
        }
        if (where?.periodId === "period-second-last") {
          return [{ userAId: "user-2", userBId: "user-5" }];
        }
        return [];
      });

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [
          { id: "user-1" },
          { id: "user-2" },
          { id: "user-3" },
          { id: "user-4" },
          { id: "user-5" },
          { id: "user-6" },
          { id: "user-7" },
          { id: "user-8" },
        ],
        newUsers: ["user-7", "user-8"],
        unpairedLastPeriod: ["user-3"],
        userBlocks: {
          "user-1": ["user-2"],
          "user-2": ["user-1"],
          "user-4": [],
          "user-5": [],
          "user-6": [],
          "user-7": [],
          "user-8": [],
          "user-3": ["user-4"],
        },
        userHistory: {
          "user-1": new Map([["user-4", 1]]),
          "user-4": new Map([["user-1", 1]]),
          "user-2": new Map([["user-5", 2]]),
          "user-5": new Map([["user-2", 2]]),
        },
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      const forbiddenPairs = [
        new Set(["user-1", "user-2"]),
        new Set(["user-1", "user-4"]),
        new Set(["user-2", "user-5"]),
        new Set(["user-3", "user-4"]),
      ];

      const pairSets = pairs.map(
        (pair) => new Set([pair.userAId, pair.userBId])
      );

      forbiddenPairs.forEach((forbidden) => {
        const exists = pairSets.some(
          (set) =>
            forbidden.size === set.size &&
            [...forbidden].every((value) => set.has(value))
        );
        expect(exists).toBe(false);
      });

      expect(pairSets.length).toBeGreaterThan(0);
      const guaranteedUsers = ["user-7", "user-8", "user-3"];
      guaranteedUsers.forEach((id) => {
        expect(pairSets.some((set) => set.has(id))).toBe(true);
      });
    });

    it("should handle impossible constraint gracefully", async () => {
      configurePrismaBase();
      pairingPeriodFindMany.mockResolvedValue([]);

      const collectPairs = captureCreatedPairs();

      mockHelpers({
        eligibleUsers: [{ id: "user-a" }, { id: "user-b" }, { id: "user-c" }],
        userBlocks: {
          "user-a": ["user-b", "user-c"],
          "user-b": ["user-c"],
          "user-c": [],
        },
      });

      await service.executePairing("org-1");

      const pairs = collectPairs();
      expect(pairs).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No pairs were created during this run"),
        PairingAlgorithmService.name
      );
    });
  });
});

describe("PairingAlgorithmService executeScheduledPairing", () => {
  let service: PairingAlgorithmService;
  let algorithmSettingFindMany: jest.Mock;
  let pairingPeriodFindFirst: jest.Mock;
  let pairingPeriodUpdate: jest.Mock;
  let pairingCount: jest.Mock;
  let logger: {
    log: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
    info: jest.Mock;
  };

  beforeEach(async () => {
    algorithmSettingFindMany = jest.fn();
    pairingPeriodFindFirst = jest.fn();
    pairingPeriodUpdate = jest.fn();
    pairingCount = jest.fn();
    logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PairingAlgorithmService,
        {
          provide: PrismaService,
          useValue: {
            algorithmSetting: { findMany: algorithmSettingFindMany },
            pairingPeriod: {
              findFirst: pairingPeriodFindFirst,
              update: pairingPeriodUpdate,
            },
            pairing: { count: pairingCount },
          } as unknown as PrismaService,
        },
        { provide: AppLoggerService, useValue: logger },
        {
          provide: PairingAlgorithmConfig,
          useValue: {
            cronEnabled: true,
            cronSchedule: "0 0 * * 1",
            defaultPeriodDays: 21,
            minPeriodDays: 7,
            maxPeriodDays: 365,
          } as PairingAlgorithmConfig,
        },
      ],
    }).compile();

    service = moduleRef.get(PairingAlgorithmService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  const dayMs = 24 * 60 * 60 * 1000;

  const endedPeriodFor = (id: string, daysOffset: number) => ({
    id,
    status: PairingPeriodStatus.active,
    endDate: new Date(Date.now() + daysOffset * dayMs),
  });

  it("should process all organizations with ended periods", async () => {
    algorithmSettingFindMany.mockResolvedValue([
      { organizationId: "org-1" },
      { organizationId: "org-2" },
      { organizationId: "org-3" },
    ]);

    const periods = new Map([
      ["org-1", endedPeriodFor("period-org-1", -1)],
      ["org-2", endedPeriodFor("period-org-2", -2)],
      ["org-3", endedPeriodFor("period-org-3", 1)],
    ]);

    pairingPeriodFindFirst.mockImplementation(async ({ where }: any) => {
      const period = periods.get(where.organizationId);
      return period ? { ...period } : null;
    });
    pairingPeriodUpdate.mockResolvedValue({});
    pairingCount.mockResolvedValue(0);

    const executePairingSpy = jest
      .spyOn(service, "executePairing")
      .mockResolvedValue(undefined);

    await service.executeScheduledPairing();

    expect(executePairingSpy).toHaveBeenCalledTimes(2);
    expect(executePairingSpy).toHaveBeenNthCalledWith(1, "org-1");
    expect(executePairingSpy).toHaveBeenNthCalledWith(2, "org-2");
    expect(pairingPeriodUpdate).toHaveBeenCalledTimes(2);
    const updatedIds = pairingPeriodUpdate.mock.calls.map(
      (call) => call[0].where.id
    );
    expect(updatedIds).toEqual(
      expect.arrayContaining(["period-org-1", "period-org-2"])
    );
    expect(updatedIds).not.toContain("period-org-3");
  });

  it("should skip organizations without algorithm settings", async () => {
    algorithmSettingFindMany.mockResolvedValue([
      { organizationId: "org-configured" },
    ]);

    pairingPeriodFindFirst.mockResolvedValue(
      endedPeriodFor("period-configured", -1)
    );
    pairingPeriodUpdate.mockResolvedValue({});
    pairingCount.mockResolvedValue(0);

    const executePairingSpy = jest
      .spyOn(service, "executePairing")
      .mockResolvedValue(undefined);

    await service.executeScheduledPairing();

    expect(executePairingSpy).toHaveBeenCalledTimes(1);
    expect(executePairingSpy).toHaveBeenCalledWith("org-configured");
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("processed=1 successes=1"),
      PairingAlgorithmService.name
    );
  });

  it("should continue processing after one org fails", async () => {
    algorithmSettingFindMany.mockResolvedValue([
      { organizationId: "org-1" },
      { organizationId: "org-2" },
      { organizationId: "org-3" },
    ]);

    const periods = new Map([
      ["org-1", endedPeriodFor("period-org-1", -1)],
      ["org-2", endedPeriodFor("period-org-2", -1)],
      ["org-3", endedPeriodFor("period-org-3", -1)],
    ]);

    pairingPeriodFindFirst.mockImplementation(async ({ where }: any) => {
      const period = periods.get(where.organizationId);
      return period ? { ...period } : null;
    });
    pairingPeriodUpdate.mockResolvedValue({});

    const pairingCounts = new Map([
      ["org-1", [0, 4]],
      ["org-2", [2]],
      ["org-3", [5, 7]],
    ]);
    pairingCount.mockImplementation(async ({ where }: any) => {
      const entries = pairingCounts.get(where.organizationId) ?? [];
      const value = entries.shift();
      if (value === undefined) {
        return 0;
      }
      pairingCounts.set(where.organizationId, entries);
      return value;
    });

    const executePairingSpy = jest
      .spyOn(service, "executePairing")
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Database error"))
      .mockResolvedValueOnce(undefined);

    await service.executeScheduledPairing();

    expect(executePairingSpy).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("org-2"),
      expect.any(String),
      PairingAlgorithmService.name
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(
        "processed=3 successes=2 skipped=0 failures=1 pairsCreated=6"
      ),
      PairingAlgorithmService.name
    );
  });

  it("should log comprehensive summary after processing", async () => {
    const organizationIds = ["org-1", "org-2", "org-3", "org-4", "org-5"];

    algorithmSettingFindMany.mockResolvedValue(
      organizationIds.map((organizationId) => ({ organizationId }))
    );

    pairingPeriodFindFirst.mockImplementation(async ({ where }: any) =>
      endedPeriodFor(`period-${where.organizationId}`, -1)
    );
    pairingPeriodUpdate.mockResolvedValue({});

    const pairingCounts = new Map([
      ["org-1", [10, 14]],
      ["org-2", [20, 24]],
      ["org-3", [5]],
      ["org-4", [8]],
      ["org-5", [0, 3]],
    ]);
    pairingCount.mockImplementation(async ({ where }: any) => {
      const entries = pairingCounts.get(where.organizationId) ?? [];
      const value = entries.shift();
      if (value === undefined) {
        return 0;
      }
      pairingCounts.set(where.organizationId, entries);
      return value;
    });

    const executePairingSpy = jest
      .spyOn(service, "executePairing")
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Scaling error"))
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockResolvedValueOnce(undefined);

    await service.executeScheduledPairing();

    expect(executePairingSpy).toHaveBeenCalledTimes(5);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(
        "processed=5 successes=3 skipped=0 failures=2 pairsCreated=11"
      ),
      PairingAlgorithmService.name
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("org-3: Scaling error"),
      PairingAlgorithmService.name
    );
    expect(logger.warn.mock.calls[0][0]).toContain("org-4: Timeout");
  });

  it("should not process if no organizations exist", async () => {
    algorithmSettingFindMany.mockResolvedValue([]);

    const executePairingSpy = jest
      .spyOn(service, "executePairing")
      .mockResolvedValue(undefined);

    await service.executeScheduledPairing();

    expect(executePairingSpy).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Scheduled pairing cron found no organizations"),
      PairingAlgorithmService.name
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(
        "processed=0 successes=0 skipped=0 failures=0 pairsCreated=0"
      ),
      PairingAlgorithmService.name
    );
  });
});
