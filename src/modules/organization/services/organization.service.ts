import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from "@nestjs/common";
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
   * 1. Generate unique organization code
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

    // Generate organization code from name
    const orgCode = this.generateOrganizationCode(data.organizationName);

    // Check if code already exists
    const existingOrg =
      await this.organizationRepository.getOrganizationByCode(orgCode);
    if (existingOrg) {
      throw new ConflictException(
        `An organization with similar name already exists. Please use a different name.`
      );
    }

    // Parse organization size
    const sizeNumber = this.parseOrganizationSize(data.organizationSize);

    return await this.prisma.$transaction(async (tx) => {
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

      if (this.supabaseAdminService.isEnabled()) {
        try {
          // Generate a temporary username from email
          const tempUsername = data.adminEmail.split("@")[0];

          // Use inviteUserByEmail - this automatically sends an invitation email
          // with a link for the user to set their password
          const supabaseResult =
            await this.supabaseAdminService.inviteUserByEmail(
              data.adminEmail,
              {
                data: {
                  username: tempUsername,
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
          } else {
            supabaseAuthId = supabaseResult.data?.user?.id ?? undefined;
            this.logger.log(
              `Invited Supabase auth user: ${data.adminEmail} (${supabaseAuthId}) - invitation email sent`
            );
          }
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            "Supabase user invitation failed",
            err.stack ?? err.message
          );
          throw new BadRequestException(
            `Failed to invite admin user: ${err.message}`
          );
        }
      } else {
        throw new BadRequestException(
          "Authentication system is not configured. Please contact support."
        );
      }

      if (!supabaseAuthId) {
        throw new BadRequestException("Failed to create authentication user");
      }

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
        this.logger.warn(
          "Trigger did not create user, creating manually"
        );
        adminUser = await tx.user.create({
          data: {
            id: supabaseAuthId,
            organizationId: organization.id,
            email: data.adminEmail,
            emailVerified: false,
            username: data.adminEmail.split("@")[0],
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
            username: data.adminEmail.split("@")[0],
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
          username: adminUser.username ?? "",
        },
      };
    });
  }

  /**
   * Generates a unique organization code from the organization name.
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
}
