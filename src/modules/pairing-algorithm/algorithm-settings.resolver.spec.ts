import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AlgorithmSettingsResolver } from './algorithm-settings.resolver';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AppLoggerService } from '../../shared/logger/logger.service';
import { PairingAlgorithmConfig } from './pairing-algorithm.config';

const fixedDate = new Date('2025-01-01T00:00:00.000Z');

describe('AlgorithmSettingsResolver', () => {
  let resolver: AlgorithmSettingsResolver;
  let prisma: jest.Mocked<PrismaService>;
  let logger: jest.Mocked<AppLoggerService>;

  const adminUser = {
    id: 'user-1',
    organizationId: 'org-1',
    role: 'admin',
    appRole: undefined,
  };

  beforeEach(async () => {
    prisma = {
      algorithmSetting: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      user: { findUnique: jest.fn() },
    } as unknown as jest.Mocked<PrismaService>;

    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<AppLoggerService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlgorithmSettingsResolver,
        { provide: PrismaService, useValue: prisma },
        { provide: AppLoggerService, useValue: logger },
        {
          provide: PairingAlgorithmConfig,
          useValue: {
            cronEnabled: true,
            cronSchedule: '0 0 * * 1',
            defaultPeriodDays: 21,
            minPeriodDays: 7,
            maxPeriodDays: 365,
          } as PairingAlgorithmConfig,
        },
      ],
    }).compile();

    resolver = module.get(AlgorithmSettingsResolver);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('updateAlgorithmSettings', () => {
    it('should update settings with valid values', async () => {
      const existing = {
        id: 'setting-1',
        organizationId: 'org-1',
        periodLengthDays: 21,
        randomSeed: 123,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      };

      (prisma.algorithmSetting.findUnique as jest.Mock).mockResolvedValue(existing);
      (prisma.algorithmSetting.update as jest.Mock).mockResolvedValue({
        ...existing,
        periodLengthDays: 14,
        randomSeed: 999,
        updatedAt: new Date('2025-01-02T00:00:00.000Z'),
      });

      const result = await resolver.updateAlgorithmSettings(
        {
          organizationId: 'org-1',
          periodLengthDays: 14,
          randomSeed: 999,
        },
        adminUser,
      );

      expect(prisma.algorithmSetting.update).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: { periodLengthDays: 14, randomSeed: 999 },
      });
      expect(result.periodLengthDays).toBe(14);
      expect(result.randomSeed).toBe(999);
      expect(result.warning).toBeNull();
    });

    it('should return warning for too short period length', async () => {
      const existing = {
        id: 'setting-1',
        organizationId: 'org-1',
        periodLengthDays: 21,
        randomSeed: 123,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      };

      (prisma.algorithmSetting.findUnique as jest.Mock).mockResolvedValue(existing);
      (prisma.algorithmSetting.update as jest.Mock).mockResolvedValue({
        ...existing,
        periodLengthDays: 1,
        updatedAt: new Date('2025-01-02T00:00:00.000Z'),
      });

      const result = await resolver.updateAlgorithmSettings(
        {
          organizationId: 'org-1',
          periodLengthDays: 1,
        },
        adminUser,
      );

  expect(result.warning).toBe('Warning: Period length is too short (< 7 days)');
    });

    it('should return warning for too long period length', async () => {
      const existing = {
        id: 'setting-1',
        organizationId: 'org-1',
        periodLengthDays: 21,
        randomSeed: 123,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      };

      (prisma.algorithmSetting.findUnique as jest.Mock).mockResolvedValue(existing);
      (prisma.algorithmSetting.update as jest.Mock).mockResolvedValue({
        ...existing,
        periodLengthDays: 400,
        updatedAt: new Date('2025-01-03T00:00:00.000Z'),
      });

      const result = await resolver.updateAlgorithmSettings(
        {
          organizationId: 'org-1',
          periodLengthDays: 400,
        },
        adminUser,
      );

  expect(result.warning).toBe('Warning: Period length is too long (> 365 days)');
    });

    it('should use default values when not provided', async () => {
      const existing = {
        id: 'setting-1',
        organizationId: 'org-1',
        periodLengthDays: 21,
        randomSeed: 555,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      };

      (prisma.algorithmSetting.findUnique as jest.Mock).mockResolvedValue(existing);
      (prisma.algorithmSetting.update as jest.Mock).mockResolvedValue(existing);

      const result = await resolver.updateAlgorithmSettings(
        {
          organizationId: 'org-1',
        },
        adminUser,
      );

      expect(prisma.algorithmSetting.update).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: { periodLengthDays: 21, randomSeed: 555 },
      });
      expect(result.periodLengthDays).toBe(21);
      expect(result.randomSeed).toBe(555);
    });

    it('should allow admin only', async () => {
      await expect(
        resolver.updateAlgorithmSettings(
          {
            organizationId: 'org-1',
            periodLengthDays: 21,
          },
          { ...adminUser, role: 'user' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getAlgorithmSettings', () => {
    it('should return existing settings', async () => {
      const existing = {
        id: 'setting-1',
        organizationId: 'org-1',
        periodLengthDays: 28,
        randomSeed: 888,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      };

      (prisma.algorithmSetting.findUnique as jest.Mock).mockResolvedValue(existing);

      const result = await resolver.getAlgorithmSettings('org-1', adminUser);

      expect(result).toEqual({ ...existing });
      expect(prisma.algorithmSetting.create).not.toHaveBeenCalled();
    });

    it('should return defaults when no settings exist', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(987654321);
      (prisma.algorithmSetting.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.algorithmSetting.create as jest.Mock).mockResolvedValue({
        id: 'setting-2',
        organizationId: 'org-1',
        periodLengthDays: 21,
        randomSeed: 987654321,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      });

      const result = await resolver.getAlgorithmSettings('org-1', adminUser);

      expect(prisma.algorithmSetting.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          periodLengthDays: 21,
          randomSeed: 987654321,
        },
      });
      expect(result.periodLengthDays).toBe(21);
      expect(result.randomSeed).toBe(987654321);
    });

    it('should allow admin only', async () => {
      await expect(
        resolver.getAlgorithmSettings('org-1', { ...adminUser, role: 'user' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
