import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { Quack } from '../domain/quack';

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<Quack | null> {
    return this.prisma.quack.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async getQuacks(): Promise<Quack[]> {
    return this.prisma.quack.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuacksByUserId(userId: string): Promise<Quack[]> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      include: { quacks: true },
    });

    return user?.quacks ?? [];
  }

  async createQuack(createQuackData: {
    text: string;
    userId: string;
  }): Promise<Quack> {
    return await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        user: {
          connect: { id: createQuackData.userId! },
        },
      },
      include: { user: true },
    });
  }

  async delete(id: string): Promise<Quack | null> {
    return this.prisma.quack.delete({
      where: { id },
      include: { user: true },
    });
  }
}
