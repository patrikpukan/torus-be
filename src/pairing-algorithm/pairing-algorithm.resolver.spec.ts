import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { PairingAlgorithmResolver } from './pairing-algorithm.resolver';
import { PairingAlgorithmService } from './pairing-algorithm.service';
import { PrismaService } from '../core/prisma/prisma.service';
import { AppLoggerService } from '../shared/logger/logger.service';
import { PairingPeriodStatus, UserRole } from '@prisma/client';

describe('PairingAlgorithmResolver', () => {
  let resolver: PairingAlgorithmResolver;
  let pairingService: jest.Mocked<PairingAlgorithmService>;
  let prisma: jest.Mocked<PrismaService>;
  let logger: jest.Mocked<AppLoggerService>;

  const mockUser = (overrides: Partial<any> = {}) => ({
    id: 'user-1',
    organizationId: 'org-1',
    role: 'admin',
    appRole: undefined,
    ...overrides,
  });

  beforeEach(async () => {
    pairingService = {
      executePairing: jest.fn(),
    } as unknown as jest.Mocked<PairingAlgorithmService>;

    prisma = {
      pairing: { count: jest.fn() },
      pairingPeriod: { findFirst: jest.fn() },
      user: { count: jest.fn() },
    } as unknown as jest.Mocked<PrismaService>;

    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<AppLoggerService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PairingAlgorithmResolver,
        { provide: PairingAlgorithmService, useValue: pairingService },
        { provide: PrismaService, useValue: prisma },
        { provide: AppLoggerService, useValue: logger },
      ],
    }).compile();

    resolver = module.get(PairingAlgorithmResolver);
  });

  it('should execute pairing when user is admin', async () => {
    (prisma.pairing.count as jest.Mock).mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    (prisma.pairingPeriod.findFirst as jest.Mock).mockResolvedValue({
      id: 'period-1',
      organizationId: 'org-1',
      status: PairingPeriodStatus.active,
      startDate: new Date(),
      endDate: new Date(),
    });
    (prisma.user.count as jest.Mock).mockResolvedValue(0);

    const result = await resolver.executePairingAlgorithm('org-1', mockUser());

  expect(pairingService.executePairing).toHaveBeenCalledWith('org-1');
  expect(result).toMatchObject({ success: true, pairingsCreated: 2, unpairedUsers: 0 });
  });

  it('should throw ForbiddenException when user is not admin', async () => {
    await expect(
      resolver.executePairingAlgorithm('org-1', mockUser({ role: 'user', appRole: 'user' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(pairingService.executePairing).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when user from different organization', async () => {
    await expect(
      resolver.executePairingAlgorithm('org-1', mockUser({ organizationId: 'org-2' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(pairingService.executePairing).not.toHaveBeenCalled();
  });

  it('should handle service errors gracefully', async () => {
  pairingService.executePairing.mockRejectedValueOnce(new Error('Not enough users'));
  (prisma.pairing.count as jest.Mock).mockResolvedValue(0);
  (prisma.pairingPeriod.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.user.count as jest.Mock).mockResolvedValue(0);

    await expect(resolver.executePairingAlgorithm('org-1', mockUser())).rejects.toBeInstanceOf(
      GraphQLError,
    );
  });

  it('should return correct pairing statistics', async () => {
    (prisma.pairing.count as jest.Mock).mockResolvedValueOnce(4).mockResolvedValueOnce(8);
    (prisma.pairingPeriod.findFirst as jest.Mock).mockResolvedValue({
      id: 'period-2',
      organizationId: 'org-1',
      status: PairingPeriodStatus.active,
      startDate: new Date(),
      endDate: new Date(),
    });
    (prisma.user.count as jest.Mock).mockResolvedValue(3);

    const result = await resolver.executePairingAlgorithm('org-1', mockUser());

  expect(result.pairingsCreated).toBe(4);
  expect(result.unpairedUsers).toBe(3);
  });
});
