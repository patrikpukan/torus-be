import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class OrgAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isOrgAdmin(email: string): Promise<boolean> {
    if (!email) {
      return false;
    }

    const orgAdminDelegate = (this.prisma as any).orgAdmin;

    const orgAdmin = await orgAdminDelegate.findUnique({
      where: { email: email.toLowerCase() },
    });

    return Boolean(orgAdmin);
  }

  async upsertOrgAdmin(email: string): Promise<void> {
    if (!email) {
      return;
    }

    const normalizedEmail = email.toLowerCase();

    const orgAdminDelegate = (this.prisma as any).orgAdmin;

    await orgAdminDelegate.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail },
      update: { email: normalizedEmail },
    });
  }

  async removeOrgAdmin(email: string): Promise<void> {
    if (!email) {
      return;
    }

    const orgAdminDelegate = (this.prisma as any).orgAdmin;

    await orgAdminDelegate.delete({
      where: { email: email.toLowerCase() },
    });
  }
}
