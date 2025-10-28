import { Test, TestingModule } from '@nestjs/testing';
import { PairingAlgorithmService } from './pairing-algorithm.service';
import { PrismaService } from '../core/prisma/prisma.service';
import { AppLoggerService } from '../shared/logger/logger.service';

describe('PairingAlgorithmService helpers', () => {
  let service: PairingAlgorithmService;
  let userFindMany: jest.Mock;
  let userBlockFindMany: jest.Mock;
  let pairingFindMany: jest.Mock;
  let pairingPeriodFindUnique: jest.Mock;
  let pairingPeriodFindFirst: jest.Mock;
  let pairingPeriodFindMany: jest.Mock;

  beforeEach(async () => {
    userFindMany = jest.fn();
    userBlockFindMany = jest.fn();
    pairingFindMany = jest.fn();
    pairingPeriodFindUnique = jest.fn();
    pairingPeriodFindFirst = jest.fn();
    pairingPeriodFindMany = jest.fn();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PairingAlgorithmService,
        {
          provide: PrismaService,
          useValue: {
            user: { findMany: userFindMany },
            userBlock: { findMany: userBlockFindMany },
            pairing: { findMany: pairingFindMany },
            pairingPeriod: {
              findUnique: pairingPeriodFindUnique,
              findFirst: pairingPeriodFindFirst,
              findMany: pairingPeriodFindMany,
            },
          },
        },
        {
          provide: AppLoggerService,
          useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(PairingAlgorithmService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('canBePaired', () => {
    it('should return true when users have no blocks or recent history', () => {
      expect(
        (service as any).canBePaired(
          'user-a',
          'user-b',
          new Set(),
          new Set(),
          new Map(),
          new Map(),
          4,
        ),
      ).toBe(true);
    });

    it('should return false when userA blocks userB', () => {
      expect(
        (service as any).canBePaired(
          'user-a',
          'user-b',
          new Set(['user-b']),
          new Set(),
          new Map(),
          new Map(),
          4,
        ),
      ).toBe(false);
    });

    it('should return false when userB blocks userA', () => {
      expect(
        (service as any).canBePaired(
          'user-a',
          'user-b',
          new Set(),
          new Set(['user-a']),
          new Map(),
          new Map(),
          4,
        ),
      ).toBe(false);
    });

    it('should return false when paired in last period', () => {
      expect(
        (service as any).canBePaired(
          'user-a',
          'user-b',
          new Set(),
          new Set(),
          new Map([['user-b', 1]]),
          new Map(),
          4,
        ),
      ).toBe(false);
    });

    it('should return false when paired in last 2 periods', () => {
      expect(
        (service as any).canBePaired(
          'user-a',
          'user-b',
          new Set(),
          new Set(),
          new Map([['user-b', 2]]),
          new Map(),
          4,
        ),
      ).toBe(false);
    });

    it('should return true when paired recently but only two users exist', () => {
      expect(
        (service as any).canBePaired(
          'user-a',
          'user-b',
          new Set(),
          new Set(),
          new Map([['user-b', 1]]),
          new Map(),
          2,
        ),
      ).toBe(true);
    });
  });

  describe('getUserBlocks', () => {
    it('should return empty set when user has no blocks', async () => {
      userBlockFindMany.mockResolvedValueOnce([]);

      const result = await (service as any).getUserBlocks('user-a');

      expect(result.size).toBe(0);
      expect(userBlockFindMany).toHaveBeenCalledWith({
        select: { blockerId: true, blockedId: true },
        where: { OR: [{ blockerId: 'user-a' }, { blockedId: 'user-a' }] },
      });
    });

    it('should return users blocked by this user', async () => {
      userBlockFindMany.mockResolvedValueOnce([
        { blockerId: 'user-a', blockedId: 'user-b' },
      ] as any);

      const result = await (service as any).getUserBlocks('user-a');

      expect(Array.from(result)).toEqual(['user-b']);
    });

    it('should return users who blocked this user', async () => {
      userBlockFindMany.mockResolvedValueOnce([
        { blockerId: 'user-c', blockedId: 'user-a' },
      ] as any);

      const result = await (service as any).getUserBlocks('user-a');

      expect(Array.from(result)).toEqual(['user-c']);
    });

    it('should return both directions (bidirectional blocking)', async () => {
      userBlockFindMany.mockResolvedValueOnce([
        { blockerId: 'user-a', blockedId: 'user-b' },
        { blockerId: 'user-c', blockedId: 'user-a' },
      ] as any);

      const result = await (service as any).getUserBlocks('user-a');

      expect(new Set(result)).toEqual(new Set(['user-b', 'user-c']));
    });
  });

  describe('getNewUsers', () => {
    it('should return users with no pairing history', async () => {
      userFindMany.mockResolvedValueOnce([
        { id: 'user-1' },
        { id: 'user-2' },
      ] as any);

      const result = await (service as any).getNewUsers('org-1');

      expect(result).toEqual(['user-1', 'user-2']);
      expect(userFindMany).toHaveBeenCalledWith({
        select: { id: true },
        where: {
          organizationId: 'org-1',
          pairingsAsUserA: { none: {} },
          pairingsAsUserB: { none: {} },
        },
      });
    });

    it('should return empty array when all users have history', async () => {
      userFindMany.mockResolvedValueOnce([]);

      const result = await (service as any).getNewUsers('org-1');

      expect(result).toEqual([]);
    });
  });

  describe('getUnpairedFromLastPeriod', () => {
    it('should return users who were eligible but not paired', async () => {
      pairingPeriodFindUnique.mockResolvedValueOnce({
        startDate: new Date('2024-03-01'),
      } as any);
      pairingPeriodFindFirst.mockResolvedValueOnce({ id: 'period-1' } as any);
      userFindMany.mockResolvedValueOnce([
        { id: 'user-1' },
        { id: 'user-2' },
        { id: 'user-3' },
      ] as any);
      pairingFindMany.mockResolvedValueOnce([
        { userAId: 'user-1', userBId: 'user-2' },
      ] as any);

      const result = await (service as any).getUnpairedFromLastPeriod('org-1', 'period-2');

      expect(result).toEqual(['user-3']);
    });

    it('should return empty array when no previous period exists', async () => {
      pairingPeriodFindUnique.mockResolvedValueOnce({
        startDate: new Date('2024-03-01'),
      } as any);
      pairingPeriodFindFirst.mockResolvedValueOnce(null);

      const result = await (service as any).getUnpairedFromLastPeriod('org-1', 'period-2');

      expect(result).toEqual([]);
    });

    it('should return empty array when all were paired last time', async () => {
      pairingPeriodFindUnique.mockResolvedValueOnce({
        startDate: new Date('2024-03-01'),
      } as any);
      pairingPeriodFindFirst.mockResolvedValueOnce({ id: 'period-1' } as any);
      userFindMany.mockResolvedValueOnce([
        { id: 'user-1' },
        { id: 'user-2' },
      ] as any);
      pairingFindMany.mockResolvedValueOnce([
        { userAId: 'user-1', userBId: 'user-2' },
      ] as any);

      const result = await (service as any).getUnpairedFromLastPeriod('org-1', 'period-2');

      expect(result).toEqual([]);
    });
  });

  describe('getEligibleUsers', () => {
    it('should return only active users', async () => {
      userFindMany.mockResolvedValueOnce([
        { id: 'user-1', isActive: true },
        { id: 'user-2', isActive: true },
      ] as any);

      const result = await (service as any).getEligibleUsers('org-1', 'period-1');

      expect(result).toEqual([
        { id: 'user-1', isActive: true },
        { id: 'user-2', isActive: true },
      ]);
      expect(userFindMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          isActive: true,
          OR: [{ suspendedUntil: null }, { suspendedUntil: { lt: expect.any(Date) } }],
          pairingsAsUserA: { none: { periodId: 'period-1' } },
          pairingsAsUserB: { none: { periodId: 'period-1' } },
        },
      });
    });

    it('should exclude suspended users', async () => {
      userFindMany.mockResolvedValueOnce([]);

      await (service as any).getEligibleUsers('org-1', 'period-1');

      expect(userFindMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          isActive: true,
          OR: [{ suspendedUntil: null }, { suspendedUntil: { lt: expect.any(Date) } }],
          pairingsAsUserA: { none: { periodId: 'period-1' } },
          pairingsAsUserB: { none: { periodId: 'period-1' } },
        },
      });
    });

    it('should exclude users already paired in current period', async () => {
      userFindMany.mockResolvedValueOnce([
        { id: 'user-1' },
        { id: 'user-4' },
      ] as any);

      const result = await (service as any).getEligibleUsers('org-1', 'period-1');

      expect(result).toEqual([
        { id: 'user-1' },
        { id: 'user-4' },
      ]);
    });
  });
});
