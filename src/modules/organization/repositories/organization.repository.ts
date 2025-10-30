import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/core/prisma/prisma.service";
import { Organization } from "../domain/organization";

type PrismaOrganizationEntity =
  Prisma.OrganizationGetPayload<Prisma.OrganizationDefaultArgs>;

const mapPrismaOrganizationToDomain = (
  org: PrismaOrganizationEntity
): Organization => {
  return {
    id: org.id,
    name: org.name,
    code: org.code,
    size: org.size,
    address: org.address,
    imageUrl: org.imageUrl,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
};

type PrismaClientOrTx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient): PrismaClientOrTx {
    return tx ?? this.prisma;
  }

  async getOrganizationById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<Organization | null> {
    const client = this.getClient(tx);
    const org = await client.organization.findUnique({ where: { id } });

    return org ? mapPrismaOrganizationToDomain(org) : null;
  }

  async getOrganizationByCode(
    code: string,
    tx?: Prisma.TransactionClient
  ): Promise<Organization | null> {
    const client = this.getClient(tx);
    const org = await client.organization.findUnique({ where: { code } });

    return org ? mapPrismaOrganizationToDomain(org) : null;
  }

  async createOrganization(
    data: {
      name: string;
      code: string;
      size?: number | null;
      address?: string | null;
      imageUrl?: string | null;
    },
    tx?: Prisma.TransactionClient
  ): Promise<Organization> {
    const client = this.getClient(tx);

    const org = await client.organization.create({
      data: {
        name: data.name,
        code: data.code,
        size: data.size,
        address: data.address,
        imageUrl: data.imageUrl,
      },
    });

    return mapPrismaOrganizationToDomain(org);
  }

  async listOrganizations(
    tx?: Prisma.TransactionClient
  ): Promise<Organization[]> {
    const client = this.getClient(tx);
    const orgs = await client.organization.findMany({
      orderBy: { createdAt: "desc" },
    });

    return orgs.map(mapPrismaOrganizationToDomain);
  }

  async updateOrganization(
    id: string,
    data: {
      name?: string;
      size?: number | null;
      address?: string | null;
      imageUrl?: string | null;
    },
    tx?: Prisma.TransactionClient
  ): Promise<Organization> {
    const client = this.getClient(tx);

    const org = await client.organization.update({
      where: { id },
      data,
    });

    return mapPrismaOrganizationToDomain(org);
  }
}
