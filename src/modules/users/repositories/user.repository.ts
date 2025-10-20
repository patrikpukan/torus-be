import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';
import {
  ProfileStatusEnum,
  User,
  UserOrganization,
  UserRoleEnum,
} from '../domain/user';

// in many production ready app, it is okay to have mappers like these across the application.
// It clearly separates database objects (used in db/repositories) from domain objects (used in services) and from presentation (used in graphql/rest resolvers) objects
// in some places, like the post repository, we can skip them because the types are at this time compatible.
// usually we would also store them in their own file, like in users/repositories/mappers/user.mapper.ts
// we keep it like this for simplicity here.
type PrismaUserEntity = Prisma.UserGetPayload<Prisma.UserDefaultArgs> & {
  supabaseUserId?: string | null;
};

type PrismaUserWithOrganizationEntity = Prisma.UserGetPayload<{
  include: { organization: true };
}> & {
  supabaseUserId?: string | null;
};

const mapPrismaUserToDomainUser = (user: PrismaUserEntity): User => {
  const profileStatus = (user as unknown as { profileStatus?: ProfileStatusEnum })
    ?.profileStatus ?? ProfileStatusEnum.pending;

  return {
    ...user,
    username: user.username ?? '', // ensure username is never undefined or null
    role: user.role as UserRoleEnum,
    profileStatus,
    profileImageUrl: user.profileImageUrl ?? undefined,
    supabaseUserId: user.supabaseUserId ?? undefined,
  };
};

const mapPrismaUserWithOrganizationToDomain = (
  user: PrismaUserWithOrganizationEntity,
): User & { organization: UserOrganization } => {
  const mappedUser = mapPrismaUserToDomainUser(user);

  return {
    ...mappedUser,
    organization: {
      id: user.organization.id,
      name: user.organization.name,
      code: user.organization.code,
      imageUrl: user.organization.imageUrl ?? null,
    },
  };
};

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}


  async getUserById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    return user ? mapPrismaUserToDomainUser(user) : null;
  }

  async getUserWithOrganizationById(
    id: string,
  ): Promise<(User & { organization: UserOrganization }) | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { organization: true },
    });

    return user ? mapPrismaUserWithOrganizationToDomain(user) : null;
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

  async listUsers(params?: { offset?: number; limit?: number }): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      skip: params?.offset,
      take: params?.limit,
      orderBy: { createdAt: 'desc' },
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
      email?: string;
      role?: UserRoleEnum;
      profileImageUrl?: string | null;
      username?: string | null;
      profileStatus?: ProfileStatusEnum;
      supabaseUserId?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      about?: string | null;
      hobbies?: string | null;
      interests?: string | null;
      preferredActivity?: string | null;
      isActive?: boolean;
      suspendedUntil?: Date | null;
    },
  ): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data: data as Prisma.UserUpdateInput,
    });

    return mapPrismaUserToDomainUser(user);
  }
}
