import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/core/prisma/prisma.service";
import {
  ProfileStatusEnum,
  User,
  UserOrganization,
  UserRoleEnum,
} from "../domain/user";

type PrismaUserEntity = Prisma.UserGetPayload<Prisma.UserDefaultArgs> & {
  supabaseUserId?: string | null;
};

type PrismaUserWithOrganizationEntity = Prisma.UserGetPayload<{
  include: { organization: true };
}> & {
  supabaseUserId?: string | null;
};

const mapPrismaUserToDomainUser = (user: PrismaUserEntity): User => {
  const profileStatus =
    (user as unknown as { profileStatus?: ProfileStatusEnum })?.profileStatus ??
    ProfileStatusEnum.pending;

  return {
    ...user,
    username: user.username ?? "",
    role: user.role as UserRoleEnum,
    profileStatus,
    profileImageUrl: user.profileImageUrl ?? undefined,
    supabaseUserId: user.supabaseUserId ?? undefined,
  };
};

const mapPrismaUserWithOrganizationToDomain = (
  user: PrismaUserWithOrganizationEntity
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

type PrismaClientOrTx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient): PrismaClientOrTx {
    return tx ?? this.prisma;
  }

  async getUserById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<User | null> {
    const client = this.getClient(tx);
    const user = await client.user.findUnique({ where: { id } });

    return user ? mapPrismaUserToDomainUser(user) : null;
  }

  async getUserWithOrganizationById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<(User & { organization: UserOrganization }) | null> {
    const client = this.getClient(tx);
    const user = await client.user.findUnique({
      where: { id },
      include: { organization: true },
    });

    return user ? mapPrismaUserWithOrganizationToDomain(user) : null;
  }

  async getUserByUserName(
    username: string,
    tx?: Prisma.TransactionClient
  ): Promise<User | null> {
    const client = this.getClient(tx);
    const user = await client.user.findUnique({ where: { username } });

    return user ? mapPrismaUserToDomainUser(user) : null;
  }

  async getUserByEmail(
    email: string,
    tx?: Prisma.TransactionClient
  ): Promise<User | null> {
    const client = this.getClient(tx);
    const user = await client.user.findUnique({ where: { email } });

    return user ? mapPrismaUserToDomainUser(user) : null;
  }

  async getUsersByIds(
    ids: string[],
    tx?: Prisma.TransactionClient
  ): Promise<User[]> {
    const client = this.getClient(tx);
    const users = await client.user.findMany({
      where: { id: { in: ids } },
    });

    return users.map(mapPrismaUserToDomainUser);
  }

  async listUsers(tx?: Prisma.TransactionClient): Promise<User[]> {
    const client = this.getClient(tx);
    const users = await client.user.findMany({
      orderBy: { createdAt: "desc" },
    });

    return users.map(mapPrismaUserToDomainUser);
  }

  async deleteUserById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<User> {
    const client = this.getClient(tx);
    const user = await client.user.delete({ where: { id } });
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
    tx?: Prisma.TransactionClient
  ): Promise<User> {
    const client = this.getClient(tx);

    const user = await client.user.update({
      where: { id },
      data: data as Prisma.UserUpdateInput,
    });

    return mapPrismaUserToDomainUser(user);
  }
}
