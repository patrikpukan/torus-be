import { Injectable } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { User, UserRoleEnum } from '../domain/user';

// in many production ready app, it is okay to have mappers like these across the application.
// It clearly separates database objects (used in db/repositories) from domain objects (used in services) and from presentation (used in graphql/rest resolvers) objects
// in some places, like the post repository, we can skip them because the types are at this time compatible.
// usually we would also store them in their own file, like in users/repositories/mappers/user.mapper.ts
// we keep it like this for simplicity here.
const mapPrismaUserToDomainUser = (user: PrismaUser): User => {
  return {
    ...user,
    username: user.username ?? '', // ensure username is never undefined or null
    role: user!.role as UserRoleEnum, // we need to map the prisma enum type to real enum type (they are not compatible)
    profileImageUrl: user.image ?? undefined,
  };
};

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUserById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    return user ? mapPrismaUserToDomainUser(user) : null;
  }

  async getUserByUserName(username: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { username } });

    return user ? mapPrismaUserToDomainUser(user) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    return user ? mapPrismaUserToDomainUser(user) : null;
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
    });

    return users.map(mapPrismaUserToDomainUser);
  }

  async deleteUserById(id: string): Promise<User> {
    const user = await this.prisma.user.delete({ where: { id } });
    return mapPrismaUserToDomainUser(user);
  }

  async updateUser(
    id: string,
    data: {
      name?: string;
      email?: string;
      role?: UserRoleEnum;
      profileImageUrl?: string;
      username?: string;
    },
  ): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        image: data.profileImageUrl,
        username: data.username,
      },
    });

    return mapPrismaUserToDomainUser(user);
  }
}
