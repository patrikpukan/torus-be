import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/core/prisma/prisma.service";
import {
  ProfileStatusEnum,
  UserOrganization,
  UserRoleEnum,
} from "../domain/user";
import { UserType } from "../graphql/types/user.type";
import { AnonUserType } from "../graphql/types/anon-user.type";

type PrismaUserEntity = Prisma.UserGetPayload<Prisma.UserDefaultArgs> & {
  supabaseUserId?: string | null;
};

type PrismaUserWithOrganizationEntity = Prisma.UserGetPayload<{
  include: { organization: true };
}> & {
  supabaseUserId?: string | null;
};

const mapPrismaUserToDomainUser = (user: PrismaUserEntity): UserType => {
  const profileStatus =
    (user as unknown as { profileStatus?: ProfileStatusEnum })?.profileStatus ??
    ProfileStatusEnum.pending;

  return {
    ...user,
    role: user.role as UserRoleEnum,
    profileStatus,
    profileImageUrl: user.profileImageUrl ?? undefined,
    supabaseUserId: user.supabaseUserId ?? undefined,
  };
};

const mapPrismaUserWithOrganizationToDomain = (
  user: PrismaUserWithOrganizationEntity
): UserType & { organization: UserOrganization } => {
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
  ): Promise<UserType | null> {
    const client = this.getClient(tx);
    const user = await client.user.findUnique({ where: { id } });

    return user ? mapPrismaUserToDomainUser(user) : null;
  }

  async getUserWithOrganizationById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<(UserType & { organization: UserOrganization }) | null> {
    const client = this.getClient(tx);
    const user = await client.user.findUnique({
      where: { id },
      include: { organization: true },
    });

    return user ? mapPrismaUserWithOrganizationToDomain(user) : null;
  }

  async getUserByEmail(
    email: string,
    tx?: Prisma.TransactionClient
  ): Promise<UserType | null> {
    const client = this.getClient(tx);
    const user = await client.user.findUnique({ where: { email } });

    return user ? mapPrismaUserToDomainUser(user) : null;
  }

  async listUsers(
    tx?: Prisma.TransactionClient,
    filters?: {
      organizationId?: string;
    }
  ): Promise<UserType[]> {
    const client = this.getClient(tx);
    const users = await client.user.findMany({
      where: filters?.organizationId
        ? {
            organizationId: filters.organizationId,
          }
        : undefined,
      orderBy: { createdAt: "desc" },
    });

    return users.map(mapPrismaUserToDomainUser);
  }

  async listAnonUsers(
    tx?: Prisma.TransactionClient,
    filters?: {
      organizationId?: string;
    }
  ): Promise<AnonUserType[]> {
    const client = this.getClient(tx);
    const users = await client.user.findMany({
      where: filters?.organizationId
        ? {
          organizationId: filters.organizationId,
        }
        : undefined,
      orderBy: { createdAt: "desc" },
    });

    return users.map(mapPrismaUserToDomainUser);
  }

  async deleteUserById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<UserType> {
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
  ): Promise<UserType> {
    const client = this.getClient(tx);

    const user = await client.user.update({
      where: { id },
      data: data as Prisma.UserUpdateInput,
    });

    return mapPrismaUserToDomainUser(user);
  }
}
