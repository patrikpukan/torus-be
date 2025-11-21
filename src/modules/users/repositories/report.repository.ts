import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/core/prisma/prisma.service";
import { ReportStatusEnum, UserReport } from "../domain/user-report";
import { mapPrismaUserToDomainUser } from "./user.repository";

type PrismaClientOrTx = Prisma.TransactionClient | PrismaService;

const reportInclude = {
  reporter: true,
  reportedUser: true,
  resolvedBy: true,
} satisfies Prisma.ReportInclude;

type PrismaReportWithRelations = Prisma.ReportGetPayload<{
  include: typeof reportInclude;
}>;

const mapReportToDomain = (report: PrismaReportWithRelations): UserReport => {
  if (!report.reporter || !report.reportedUser) {
    throw new Error(`Report ${report.id} is missing user relations`);
  }

  const status = report.resolvedById
    ? ReportStatusEnum.resolved
    : ReportStatusEnum.pending;

  return {
    id: report.id,
    reason: report.reason ?? "",
    createdAt: report.createdAt,
    pairingId: report.pairingId,
    reporterId: report.reporterId,
    reportedUserId: report.reportedUserId,
    reporter: mapPrismaUserToDomainUser(report.reporter),
    reportedUser: mapPrismaUserToDomainUser(report.reportedUser),
    resolvedBy: report.resolvedBy
      ? mapPrismaUserToDomainUser(report.resolvedBy)
      : null,
    resolutionNote: report.resolutionNote ?? null,
    status,
    resolvedAt: report.resolvedAt ?? null,
  };
};

@Injectable()
export class ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient): PrismaClientOrTx {
    return tx ?? this.prisma;
  }

  async listReports(
    filter: { organizationId?: string | null },
    tx?: Prisma.TransactionClient
  ): Promise<UserReport[]> {
    const client = this.getClient(tx);
    const where: Prisma.ReportWhereInput = {};

    if (filter.organizationId) {
      where.reportedUser = { organizationId: filter.organizationId };
    }

    const reports = await client.report.findMany({
      where,
      include: reportInclude,
      orderBy: { createdAt: "desc" },
    });

    return reports.map(mapReportToDomain);
  }

  async findById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<UserReport | null> {
    const client = this.getClient(tx);
    const report = await client.report.findUnique({
      where: { id },
      include: reportInclude,
    });

    return report ? mapReportToDomain(report) : null;
  }

  async resolveReport(
    id: string,
    data: { resolvedById: string; resolutionNote?: string | null },
    tx?: Prisma.TransactionClient
  ): Promise<UserReport> {
    const client = this.getClient(tx);
    const report = await client.report.update({
      where: { id },
      data: {
        resolvedById: data.resolvedById,
        resolutionNote: data.resolutionNote ?? null,
        resolvedAt: new Date(),
      },
      include: reportInclude,
    });

    return mapReportToDomain(report);
  }
}
