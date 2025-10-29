
import { PrismaClient } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';
import { main, prisma } from './db-reset';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockDeep<PrismaClient>()),
}));

const prismaMock = jest.mocked(prisma);

describe('db-reset', () => {
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    exitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should disable foreign key constraints, drop tables and types, and disconnect', async () => {
    prismaMock.$executeRawUnsafe.mockResolvedValue(1);

    await main();

    expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('DISABLE TRIGGER ALL'));
    expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('DROP TABLE IF EXISTS'));
    expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('DROP TYPE IF EXISTS'));
    expect(prismaMock.$disconnect).toHaveBeenCalled();
  });

  it('should handle errors during the reset process', async () => {
    const error = new Error('Test error');
    prismaMock.$executeRawUnsafe.mockRejectedValue(error);

    await main();

    expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Error during reset:', error);
    expect(prismaMock.$disconnect).toHaveBeenCalled();
  });
});
