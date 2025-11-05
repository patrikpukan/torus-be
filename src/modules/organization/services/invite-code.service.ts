import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "src/core/prisma/prisma.service";
import { randomBytes } from "crypto";

@Injectable()
export class InviteCodeService {
  private readonly logger = new Logger(InviteCodeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a unique alphanumeric code for invites
   * Format: 8-12 uppercase alphanumeric characters
   * Examples: "TORUS1234", "ABC123XYZ"
   */
  private generateCode(): string {
    const length = Math.floor(Math.random() * 5) + 8; // 8-12 characters
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    const randomBytes_ = randomBytes(length);
    for (let i = 0; i < length; i++) {
      code += chars[randomBytes_[i] % chars.length];
    }
    return code;
  }

  /**
   * Creates a new invite code for an organization
   */
  async createInviteCode(
    organizationId: string,
    createdById: string,
    options?: {
      maxUses?: number;
      expiresInHours?: number;
    }
  ): Promise<{
    id: string;
    code: string;
    inviteUrl: string;
    expiresAt?: Date;
  }> {
    // Verify organization exists
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException(
        `Organization with id ${organizationId} not found`
      );
    }

    // Verify user exists and belongs to org
    const user = await this.prisma.user.findUnique({
      where: { id: createdById },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${createdById} not found`);
    }

    if (user.organizationId !== organizationId) {
      throw new BadRequestException(
        "User does not belong to this organization"
      );
    }

    // Generate unique code
    let code = this.generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await this.prisma.inviteCode.findUnique({
        where: { code },
      });
      if (!existing) break;
      code = this.generateCode();
      attempts++;
    }

    if (attempts >= 10) {
      throw new BadRequestException("Failed to generate unique invite code");
    }

    // Calculate expiration date
    const expiresAt = options?.expiresInHours
      ? new Date(Date.now() + options.expiresInHours * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default: 30 days

    // Create invite code
    const inviteCode = await this.prisma.inviteCode.create({
      data: {
        code,
        organizationId,
        createdById,
        expiresAt,
        maxUses: options?.maxUses,
        isActive: true,
      },
    });

    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const inviteUrl = `${baseUrl}/register?invite=${code}`;

    this.logger.log(
      `Created invite code ${code} for organization ${org.name} (${organizationId})`
    );

    return {
      id: inviteCode.id,
      code: inviteCode.code,
      inviteUrl,
      expiresAt: inviteCode.expiresAt,
    };
  }

  /**
   * Validates an invite code
   */
  async validateInviteCode(code: string): Promise<{
    isValid: boolean;
    message: string;
    organizationId?: string;
    organizationName?: string;
    expiresAt?: Date;
    remainingUses?: number;
  }> {
    const inviteCode = await this.prisma.inviteCode.findUnique({
      where: { code },
      include: {
        organization: true,
      },
    });

    if (!inviteCode) {
      return {
        isValid: false,
        message: "Invite code not found or invalid",
      };
    }

    if (!inviteCode.isActive) {
      return {
        isValid: false,
        message: "Invite code has been deactivated",
        organizationId: inviteCode.organization.id,
        organizationName: inviteCode.organization.name,
      };
    }

    if (inviteCode.expiresAt && new Date() > inviteCode.expiresAt) {
      return {
        isValid: false,
        message: "Invite code has expired",
        organizationId: inviteCode.organization.id,
        organizationName: inviteCode.organization.name,
        expiresAt: inviteCode.expiresAt,
      };
    }

    if (
      inviteCode.maxUses &&
      inviteCode.usedCount >= inviteCode.maxUses
    ) {
      return {
        isValid: false,
        message: "Invite code has reached maximum uses",
        organizationId: inviteCode.organization.id,
        organizationName: inviteCode.organization.name,
        remainingUses: 0,
      };
    }

    return {
      isValid: true,
      message: "Invite code is valid",
      organizationId: inviteCode.organization.id,
      organizationName: inviteCode.organization.name,
      expiresAt: inviteCode.expiresAt,
      remainingUses: inviteCode.maxUses
        ? inviteCode.maxUses - inviteCode.usedCount
        : undefined,
    };
  }

  /**
   * Gets all invite codes for an organization
   */
  async getOrganizationInviteCodes(organizationId: string) {
    const codes = await this.prisma.inviteCode.findMany({
      where: { organizationId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    return codes.map((code) => ({
      ...code,
      inviteUrl: `${baseUrl}/register?invite=${code.code}`,
    }));
  }

  /**
   * Increments the used count when a user registers with an invite code
   */
  async incrementInviteCodeUsage(code: string): Promise<void> {
    const inviteCode = await this.prisma.inviteCode.findUnique({
      where: { code },
    });

    if (!inviteCode) {
      throw new NotFoundException(`Invite code ${code} not found`);
    }

    await this.prisma.inviteCode.update({
      where: { code },
      data: {
        usedCount: inviteCode.usedCount + 1,
      },
    });

    this.logger.log(
      `Incremented usage for invite code ${code}. New count: ${inviteCode.usedCount + 1}`
    );
  }

  /**
   * Deactivates an invite code
   */
  async deactivateInviteCode(codeId: string): Promise<void> {
    const inviteCode = await this.prisma.inviteCode.findUnique({
      where: { id: codeId },
    });

    if (!inviteCode) {
      throw new NotFoundException(`Invite code with id ${codeId} not found`);
    }

    await this.prisma.inviteCode.update({
      where: { id: codeId },
      data: { isActive: false },
    });

    this.logger.log(`Deactivated invite code: ${inviteCode.code}`);
  }
}
