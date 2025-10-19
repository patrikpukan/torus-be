import { Quack } from 'src/modules/quack/domain/quack';
import { PrismaService } from '../../../core/prisma/prisma.service';

type CreateQuackParams = {
  text: string;
  userId: string;
};

export async function createQuack(
  prisma: PrismaService,
  params: CreateQuackParams,
): Promise<Quack> {
  const { text, userId } = params;

  return await prisma.quack.create({
    data: {
      text,
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });
}
