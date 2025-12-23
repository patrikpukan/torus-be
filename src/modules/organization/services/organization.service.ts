import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "src/core/prisma/prisma.service";
import { SupabaseAdminService } from "src/shared/auth/supabase-admin.service";
import { OrganizationRepository } from "../repositories/organization.repository";
import { Organization, OrganizationWithAdmin } from "../domain/organization";
import { UserRoleEnum } from "src/modules/users/domain/user";

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly prisma: PrismaService,
    private readonly supabaseAdminService: SupabaseAdminService
  ) {}

  /**
   * Registers a new organization along with its admin user.
   * Steps:
   * 1. Generate unique organization code with retry strategy
   * 2. Create organization in database
   * 3. Invite Supabase auth user (sends invitation email automatically)
   * 4. Database trigger creates user record in our database
   * 5. Update user with correct organization and org_admin role
   */
  async registerOrganization(data: {
    adminEmail: string;
    organizationName: string;
    organizationSize: string;
    organizationAddress: string;
  }): Promise<OrganizationWithAdmin> {
    // Check if email already exists
    const existingUserByEmail = await this.prisma.user.findUnique({
      where: { email: data.adminEmail },
    });

    if (existingUserByEmail) {
      throw new ConflictException(
        "A user with this email already exists. Please use a different email."
      );
    }

    // Generate unique organization code with retry strategy for collisions
    const orgCode = await this.generateUniqueOrganizationCode(
      data.organizationName
    );

    // Parse organization size
    const sizeNumber = this.parseOrganizationSize(data.organizationSize);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create organization
      const organization = await this.organizationRepository.createOrganization(
        {
          name: data.organizationName,
          code: orgCode,
          size: sizeNumber,
          address: data.organizationAddress,
        },
        tx
      );

      this.logger.log(
        `Created organization: ${organization.name} (${organization.id})`
      );

      // 2. Invite Supabase auth user - this sends invitation email automatically
      // The trigger will create the user in public.user table
      let supabaseAuthId: string | undefined;

      if (!this.supabaseAdminService.isEnabled()) {
        throw new BadRequestException(
          "Authentication system is not configured. Please contact support."
        );
      }

      // Use inviteUserByEmail - this automatically sends an invitation email
      // with a link for the user to set their password
      const supabaseResult = await this.supabaseAdminService.inviteUserByEmail(
        data.adminEmail,
        {
          data: {
            organization_id: organization.id,
            organization_name: organization.name,
            role: UserRoleEnum.org_admin,
          },
        }
      );

      if (supabaseResult.error) {
        this.logger.error(
          `Supabase user invitation error: ${supabaseResult.error.message}`,
          supabaseResult.error.stack
        );
        throw new BadRequestException(
          `Failed to invite admin user: ${supabaseResult.error.message}`
        );
      }

      supabaseAuthId = supabaseResult.data?.user?.id ?? undefined;
      if (!supabaseAuthId) {
        throw new BadRequestException("Failed to create authentication user");
      }

      this.logger.log(
        `Invited Supabase auth user: ${data.adminEmail} (${supabaseAuthId}) - invitation email sent`
      );

      // 3. The trigger automatically creates a user in public.user table
      // We need to update it with the correct organization and role
      // Wait a moment for trigger to execute
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check if user was created by trigger
      let adminUser = await tx.user.findUnique({
        where: { id: supabaseAuthId },
      });

      if (!adminUser) {
        // If trigger didn't create user (no default org), create manually
        this.logger.warn("Trigger did not create user, creating manually");
        adminUser = await tx.user.create({
          data: {
            id: supabaseAuthId,
            organizationId: organization.id,
            email: data.adminEmail,
            emailVerified: false,
            role: UserRoleEnum.org_admin,
            supabaseUserId: supabaseAuthId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      } else {
        // Update the user created by trigger with correct org and role
        adminUser = await tx.user.update({
          where: { id: supabaseAuthId },
          data: {
            organizationId: organization.id,
            role: UserRoleEnum.org_admin,
          },
        });
      }

      this.logger.log(
        `Admin user configured: ${adminUser.email} (${adminUser.id}) for organization ${organization.name}`
      );

      return {
        ...organization,
        adminUser: {
          id: adminUser.id,
          email: adminUser.email,
        },
      };
    });
  }

  /**
   * Generates a unique organization code with collision retry strategy.
   *
   * RETRY STRATEGY:
   * 1. Generate base code from organization name (e.g., "acme-corp")
   * 2. Check if code exists in database
   * 3. If collision occurs, append random 4-character suffix (e.g., "acme-corp-a7f2")
   * 4. Retry up to 5 times with different random suffixes
   * 5. Only throw ConflictException after all retries exhausted (extremely rare)
   *
   * PROBABILITY: With 5 retries, probability of collision is < 0.0001%
   * - Base code space: 36^4 = 1,679,616 possible suffixes
   * - 5 retries means checking 5 different codes
   *
   * @param name - Organization name to generate code from
   * @returns Unique organization code
   * @throws ConflictException if unable to generate unique code after 5 retries
   */
  private async generateUniqueOrganizationCode(name: string): Promise<string> {
    const MAX_RETRIES = 5;
    const SUFFIX_LENGTH = 4;
    const baseCode = this.generateOrganizationCode(name);

    // Track collision attempts for logging
    let collisionCount = 0;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // First attempt uses base code without suffix
      let candidateCode = baseCode;

      if (attempt > 0) {
        // Subsequent attempts add random suffix
        const randomSuffix = this.generateRandomSuffix(SUFFIX_LENGTH);
        candidateCode = `${baseCode}-${randomSuffix}`;
      }

      // Check if code already exists
      const existingOrg =
        await this.organizationRepository.getOrganizationByCode(candidateCode);

      if (!existingOrg) {
        // Success - unique code found
        if (collisionCount > 0) {
          this.logger.debug(
            `Generated unique org code after ${collisionCount} collision(s): ${candidateCode} (base: ${baseCode})`
          );
        }
        return candidateCode;
      }

      // Collision occurred - log and retry
      collisionCount++;
      this.logger.debug(
        `Organization code collision (attempt ${attempt + 1}/${MAX_RETRIES}): ${candidateCode}`
      );
    }

    // All retries exhausted - this is extremely unlikely
    this.logger.error(
      `Failed to generate unique organization code after ${MAX_RETRIES} retries. Base: ${baseCode}, Collisions: ${collisionCount}`
    );
    throw new ConflictException(
      "Unable to generate unique organization code. Please try again with a different organization name."
    );
  }

  /**
   * Generates a random suffix for organization code uniqueness.
   * Uses crypto.randomBytes for secure randomization.
   *
   * @param length - Length of the random suffix (default: 4)
   * @returns Random alphanumeric string (lowercase + digits)
   */
  private generateRandomSuffix(length: number = 4): string {
    // Generate random bytes and convert to base36 (0-9, a-z)
    // Each random byte contributes ~5.2 bits of entropy
    const bytes = randomBytes(Math.ceil(length * 0.6));
    let result = "";

    for (const byte of bytes) {
      // Use modulo 36 to map to 0-9, a-z range
      result += (byte % 36).toString(36);
    }

    return result.substring(0, length);
  }

  /**
   * Generates a basic organization code from the organization name.
   * Format: lowercase, alphanumeric only, max 50 chars
   */
  private generateOrganizationCode(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);
  }

  /**
   * Parses organization size string to a number (midpoint of range)
   */
  private parseOrganizationSize(sizeStr: string): number | null {
    const sizeMap: Record<string, number> = {
      "1-10": 5,
      "11-50": 30,
      "51-200": 125,
      "201-500": 350,
      "501+": 1000,
    };

    return sizeMap[sizeStr] ?? null;
  }

  /**
   * Lists all organizations
   */
  async listOrganizations(): Promise<Organization[]> {
    return this.organizationRepository.listOrganizations();
  }

  /**
   * Gets a specific organization by ID
   */
  async getOrganizationById(id: string): Promise<Organization | null> {
    return this.organizationRepository.getOrganizationById(id);
  }

  /**
   * Gets the organization for a specific user
   */
  async getOrganizationByUserId(userId: string): Promise<Organization | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user || !user.organization) {
      return null;
    }

    return {
      id: user.organization.id,
      name: user.organization.name,
      code: user.organization.code,
      size: user.organization.size,
      address: user.organization.address,
      imageUrl: user.organization.imageUrl,
      createdAt: user.organization.createdAt,
      updatedAt: user.organization.updatedAt,
    };
  }

  /**
   * Updates an organization
   */
  async updateOrganization(
    id: string,
    data: {
      name?: string;
      size?: number | null;
      address?: string | null;
      imageUrl?: string | null;
    }
  ): Promise<Organization> {
    return this.organizationRepository.updateOrganization(id, data);
  }

  /**
   * Invites a user to an organization
   * Creates user in Supabase Auth and our database (via trigger)
   */
  async inviteUserToOrganization(
    email: string,
    organizationId: string
  ): Promise<{ success: boolean; message: string; userId?: string }> {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        success: false,
        message: "A user with this email already exists.",
      };
    }

    // Verify organization exists
    const organization =
      await this.organizationRepository.getOrganizationById(organizationId);
    if (!organization) {
      return {
        success: false,
        message: "Organization not found.",
      };
    }

    // Invite user via Supabase
    if (!this.supabaseAdminService.isEnabled()) {
      return {
        success: false,
        message: "Authentication system is not configured.",
      };
    }

    try {
      const supabaseResult = await this.supabaseAdminService.inviteUserByEmail(
        email,
        {
          data: {
            organization_id: organizationId,
            organization_name: organization.name,
            role: UserRoleEnum.user,
          },
        }
      );

      if (supabaseResult.error) {
        this.logger.error(
          `Failed to invite user: ${supabaseResult.error.message}`,
          supabaseResult.error.stack
        );
        return {
          success: false,
          message: `Failed to invite user: ${supabaseResult.error.message}`,
        };
      }

      const supabaseUserId = supabaseResult.data?.user?.id;

      if (!supabaseUserId) {
        return {
          success: false,
          message: "Failed to create authentication user.",
        };
      }

      // Wait for trigger to create user
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Update user with correct organization
      await this.prisma.user.update({
        where: { id: supabaseUserId },
        data: {
          organizationId: organizationId,
          role: UserRoleEnum.user,
        },
      });

      this.logger.log(
        `User invited successfully: ${email} to organization ${organization.name}`
      );

      return {
        success: true,
        message: `Invitation sent to ${email}. They will receive an email to set up their account.`,
        userId: supabaseUserId,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to invite user: ${err.message}`, err.stack);
      return {
        success: false,
        message: `Failed to invite user: ${err.message}`,
      };
    }
  }
}
