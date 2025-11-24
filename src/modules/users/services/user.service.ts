import * as fs from "fs";
import * as path from "path";
import { pipeline } from "stream/promises";
import { randomUUID } from "crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CurrentUser,
  ProfileStatusEnum,
  UserRoleEnum,
} from "../domain/user";
import { computeDerivedPairingStatus } from "../../calendar/domain/pairing-status.machine";
import { UserRepository } from "../repositories/user.repository";
import { Identity } from "src/shared/auth/domain/identity";
import { PrismaService } from "src/core/prisma/prisma.service";
import { withRls } from "src/db/withRls";
import { getRlsClaims } from "src/shared/auth/utils/get-rls-claims";
import { SupabaseAdminService } from "src/shared/auth/supabase-admin.service";
import { InviteCodeService } from "../../organization/services/invite-code.service";
import { PairingStatusEnum } from "../graphql/types/pairing-history.type";
import { UserBanRepository } from "../repositories/user-ban.repository";
import { AuthorizationService } from "src/shared/auth/services/authorization.service";
import { AnonUserType } from "../graphql/types/anon-user.type";
import { UserType } from "../graphql/types/user.type";
import { Config } from "src/shared/config/config.service";
import { EmailService } from "src/shared/email/email.service";
import { buildBanEmail } from "src/shared/email/templates/ban";
import { buildUnbanEmail } from "src/shared/email/templates/unban";
import { ReportStatusEnum, UserReport } from "../domain/user-report";
import { ReportRepository } from "../repositories/report.repository";

// Define an interface for the file upload
interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => NodeJS.ReadableStream;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly userBanRepository: UserBanRepository,
    private readonly reportRepository: ReportRepository,
    private readonly prisma: PrismaService,
    private readonly supabaseAdminService: SupabaseAdminService,
    private readonly authorizationService: AuthorizationService,
    private readonly config: Config,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => InviteCodeService))
    private readonly inviteCodeService: InviteCodeService
  ) {}

  async getUserById(identity: Identity, id: string): Promise<UserType | null> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const user = await this.userRepository.getUserById(id, tx);

      if (!user) {
        return null;
      }

      const canView = await this.authorizationService.canViewUser(
        identity,
        user.id,
        user.organizationId
      );
      this.authorizationService.throwIfNoPermission(canView);

      const role = identity.appRole as UserRoleEnum | undefined;
      if (
        role === UserRoleEnum.user &&
        identity.id !== user.id &&
        (await this.getBlockedUserIdsForUser(identity.id, tx)).has(user.id)
      ) {
        throw new ForbiddenException(
          "You no longer have access to this profile."
        );
      }

      const activeBan = await this.userBanRepository.findActiveBanByUserId(
        user.id,
        tx
      );

      return {
        ...user,
        activeBan,
      };
    });
  }

  async getCurrentUser(identity: Identity): Promise<CurrentUser | null> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const user =
        await this.userRepository.getUserWithOrganizationById(
          identity.id,
          tx
        );

      if (!user) {
        return null;
      }

      const activeBan = await this.userBanRepository.findActiveBanByUserId(
        user.id,
        tx
      );

      return {
        ...user,
        activeBan,
      };
    });
  }

  async listUsers(identity: Identity): Promise<UserType[]> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const role = identity.appRole as UserRoleEnum | undefined;
      const isSuperAdmin = role === UserRoleEnum.super_admin;
      const isOrgAdmin = role === UserRoleEnum.org_admin;

      if (!isSuperAdmin && !isOrgAdmin) {
        throw new ForbiddenException(
          "Only organization administrators can view users"
        );
      }

      const organizationId = isSuperAdmin ? undefined : identity.organizationId;

      if (!isSuperAdmin && !organizationId) {
        throw new ForbiddenException("Organization context is missing");
      }

      const users = await this.userRepository.listUsers(
        tx,
        organizationId ? { organizationId } : undefined
      );
      const bans = await this.userBanRepository.findActiveBansByUserIds(
        users.map((user) => user.id),
        tx
      );

      return users.map((user) => ({
        ...user,
        activeBan: bans.get(user.id) ?? null,
      }));
    });
  }

  async listAnonUsers(identity: Identity): Promise<AnonUserType[]> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const organizationId = identity.organizationId;

      const users = await this.userRepository.listAnonUsers(tx, {
        organizationId,
      });
      const blockedUserIds = await this.getBlockedUserIdsForUser(
        identity.id,
        tx
      );

      return users.filter(
        (user) =>
          user.id !== identity.id && !blockedUserIds.has(user.id ?? "")
      );
    });
  }

  // Creation of users is handled via signUp (BetterAuth) flow.

  async deleteUserById(identity: Identity, id: string): Promise<UserType> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const user = await this.userRepository.getUserById(id, tx);

      if (!user) {
        throw new NotFoundException();
      }

      return this.userRepository.deleteUserById(id, tx);
    });
  }

  async updateUserById(
    identity: Identity,
    id: string,
    data: {
      email?: string;
      role?: UserRoleEnum;
      profileImageUrl?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      about?: string | null;
      hobbies?: string | null;
      interests?: string | null;
      preferredActivity?: string | null;
      isActive?: boolean;
      suspendedUntil?: Date | null;
    }
  ): Promise<UserType> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const user = await this.userRepository.getUserById(id, tx);

      if (!user) {
        throw new NotFoundException();
      }

      return this.userRepository.updateUser(id, data, tx);
    });
  }

  async updateCurrentUserProfile(
    identity: Identity,
    data: {
      firstName?: string | null;
      lastName?: string | null;
      about?: string | null;
      location?: string | null;
      position?: string | null;
      hobbyIds?: string[];
      interestIds?: string[];
      preferredActivity?: string | null;
      avatarUrl?: string | null;
      departmentId?: string | null;
    }
  ): Promise<CurrentUser> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const existingUser =
        await this.userRepository.getUserWithOrganizationById(identity.id, tx);

      if (!existingUser) {
        throw new NotFoundException();
      }

      // Update user profile
      await this.userRepository.updateUser(
        identity.id,
        {
          firstName: data.firstName,
          lastName: data.lastName,
          about: data.about,
          location: data.location,
          position: data.position,
          preferredActivity: data.preferredActivity,
          profileImageUrl:
            typeof data.avatarUrl !== "undefined" ? data.avatarUrl : undefined,
          departmentId:
            typeof data.departmentId !== "undefined" ? data.departmentId : undefined,
        },
        tx
      );

      // Update hobbies if provided
      if (Array.isArray(data.hobbyIds)) {
        // Delete existing hobbies
        await tx.userTag.deleteMany({
          where: {
            userId: identity.id,
            tag: {
              category: "HOBBY",
            },
          },
        });

        // Add new hobbies
        for (const hobbyId of data.hobbyIds) {
          await tx.userTag.upsert({
            where: {
              userId_tagId: {
                userId: identity.id,
                tagId: hobbyId,
              },
            },
            update: {},
            create: {
              userId: identity.id,
              tagId: hobbyId,
            },
          });
        }
      }

      // Update interests if provided
      if (Array.isArray(data.interestIds)) {
        // Delete existing interests
        await tx.userTag.deleteMany({
          where: {
            userId: identity.id,
            tag: {
              category: "INTEREST",
            },
          },
        });

        // Add new interests
        for (const interestId of data.interestIds) {
          await tx.userTag.upsert({
            where: {
              userId_tagId: {
                userId: identity.id,
                tagId: interestId,
              },
            },
            update: {},
            create: {
              userId: identity.id,
              tagId: interestId,
            },
          });
        }
      }

      const updatedUser = await this.userRepository.getUserWithOrganizationById(
        identity.id,
        tx
      );

      if (!updatedUser) {
        throw new NotFoundException();
      }

      return updatedUser;
    });
  }

  async signUp(
    data: {
      email: string;
      password: string;
      firstName?: string | null;
      lastName?: string | null;
      inviteCode?: string | null;
      organizationId?: string;
    },
    profilePicture?: Promise<FileUpload>
  ): Promise<UserType> {
    const existingUser = await this.userRepository.getUserByEmail(data.email);
    if (existingUser) {
      throw new ConflictException("Email already exists");
    }

    // Validate invite code if provided
    let organizationId = data.organizationId;
    if (data.inviteCode) {
      const validation = await this.inviteCodeService.validateInviteCode(
        data.inviteCode
      );
      if (!validation.isValid) {
        throw new BadRequestException(validation.message);
      }
      organizationId = validation.organizationId;
      if (!organizationId) {
        throw new BadRequestException(
          "Invalid invite code: organization not found"
        );
      }
    }

    // Organization ID is now required (either from invite code or parameter)
    if (!organizationId) {
      throw new BadRequestException(
        "Organization ID is required. Please use a valid invite code."
      );
    }

    let supabaseAuthId: string | undefined;

    if (this.supabaseAdminService.isEnabled()) {
      try {
        const supabaseResult = await this.supabaseAdminService.createUser({
          email: data.email,
          password: data.password,
          email_confirm: true,
          user_metadata: {
            first_name: data.firstName ?? undefined,
            last_name: data.lastName ?? undefined,
            organization_id: organizationId,
          },
        });

        if (supabaseResult.error) {
          this.logger.error(
            `Supabase auth user creation error: ${supabaseResult.error.message}`,
            supabaseResult.error.stack
          );
        } else {
          supabaseAuthId = supabaseResult.data?.user?.id ?? undefined;
        }
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          "Supabase auth user creation failed",
          err.stack ?? err.message
        );
      }
    } else {
      this.logger.warn(
        "Supabase admin client is disabled; skipping Supabase user provisioning"
      );
    }

    // Check if user exists in database (might have been created by trigger or earlier)
    let newUser = await this.userRepository.getUserByEmail(data.email);

    // If user doesn't exist in database, create them explicitly
    if (!newUser) {
      try {
        await this.prisma.user.create({
          data: {
            id: supabaseAuthId || randomUUID(),
            email: data.email,
            supabaseUserId: supabaseAuthId,
            firstName: data.firstName,
            lastName: data.lastName,
            organizationId: organizationId,
            role: UserRoleEnum.user,
            profileStatus: "pending",
            isActive: true,
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        this.logger.log(
          `Created user ${supabaseAuthId} in database for ${data.email}`
        );

        newUser = await this.userRepository.getUserByEmail(data.email);
      } catch (error) {
        this.logger.error(
          `Failed to create user in database: ${(error as Error).message}`,
          (error as Error).stack
        );
        throw new BadRequestException("Failed to create user in database");
      }
    }

    if (!newUser) {
      throw new BadRequestException("Failed to create or retrieve user");
    }

    // Update user with profile info if not already set
    if (!newUser.firstName || !newUser.lastName || !newUser.supabaseUserId) {
      await this.userRepository.updateUser(newUser.id, {
        role: UserRoleEnum.user,
        supabaseUserId: supabaseAuthId ?? newUser.supabaseUserId,
        firstName: data.firstName,
        lastName: data.lastName,
      });
    }

    // Ensure organization is correctly assigned
    if (newUser.organizationId !== organizationId) {
      await this.prisma.user.update({
        where: { id: newUser.id },
        data: { organizationId },
      });
      this.logger.log(
        `Assigned user ${newUser.id} to organization ${organizationId}`
      );
    }

    // Increment invite code usage if one was used
    if (data.inviteCode) {
      try {
        await this.inviteCodeService.incrementInviteCodeUsage(data.inviteCode);
      } catch (error) {
        this.logger.warn(
          `Failed to increment invite code usage: ${(error as Error).message}`
        );
        // Don't fail the signup if invite code usage tracking fails
      }
    }

    if (profilePicture) {
      try {
        const file = await profilePicture;
        const uploadDir = path.join(
          process.cwd(),
          "uploads",
          "profile-pictures"
        );

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileExtension = file.filename.split(".").pop();
        const fileName = `${newUser.id}.${fileExtension}`;
        const filePath = path.join(uploadDir, fileName);

        const writeStream = fs.createWriteStream(filePath);

        await pipeline(file.createReadStream(), writeStream);

        await this.userRepository.updateUser(newUser.id, {
          profileImageUrl: `/uploads/profile-pictures/${fileName}`,
        });
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          "Error uploading profile picture",
          err.stack ?? err.message
        );
        throw new BadRequestException("Failed to upload profile picture");
      }
    }

    return this.userRepository.getUserById(newUser.id) as Promise<UserType>;
  }

  /**
   * Get all users that the current user has been paired with historically.
   * Returns distinct users from all pairings (both as userA and userB).
   */
  async getPairedUsers(identity: Identity): Promise<UserType[]> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      // Get all pairings where current user is involved
      const pairings = await tx.pairing.findMany({
        where: {
          OR: [{ userAId: identity.id }, { userBId: identity.id }],
        },
        include: {
          userA: true,
          userB: true,
        },
      });
      const blockedUserIds = await this.getBlockedUserIdsForUser(
        identity.id,
        tx
      );

      // Extract paired users (remove duplicates)
      const pairedUserIds = new Set<string>();
      const pairedUsers: UserType[] = [];

      for (const pairing of pairings) {
        const pairedUserId =
          pairing.userAId === identity.id ? pairing.userBId : pairing.userAId;
        const pairedUser =
          pairing.userAId === identity.id ? pairing.userB : pairing.userA;

        if (
          !pairedUserIds.has(pairedUserId) &&
          !blockedUserIds.has(pairedUserId)
        ) {
          pairedUserIds.add(pairedUserId);
          pairedUsers.push(pairedUser as UserType);
        }
      }

      return pairedUsers;
    });
  }

  /**
   * Get pairing history for current user with detailed pairing information.
   * Returns all pairings (both as userA and userB) sorted by creation date (newest first).
   */
  async getPairingHistory(identity: Identity): Promise<
    Array<{
      id: string;
      userAId: string;
      userBId: string;
      status: PairingStatusEnum;
      createdAt: Date;
      userA: UserType;
      userB: UserType;
      derivedStatus: PairingStatusEnum;
    }>
  > {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      // Get all pairings where current user is involved, sorted by newest first
      const pairings = await tx.pairing.findMany({
        where: {
          OR: [{ userAId: identity.id }, { userBId: identity.id }],
        },
        include: {
          userA: true,
          userB: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      const reportedUserIds = await this.getReportedUserIdsForUser(
        identity.id,
        tx
      );
      const blockedUserIds = await this.getBlockedUserIdsForUser(
        identity.id,
        tx
      );

      const results: Array<{
        id: string;
        userAId: string;
        userBId: string;
        status: PairingStatusEnum;
        createdAt: Date;
        userA: UserType;
        userB: UserType;
        derivedStatus: PairingStatusEnum;
      }> = [];

      for (const pairing of pairings) {
        const contactUserId =
          pairing.userAId === identity.id ? pairing.userBId : pairing.userAId;

        if (
          reportedUserIds.has(contactUserId) ||
          blockedUserIds.has(contactUserId)
        ) {
          continue;
        }

        const latestMeeting = await tx.meetingEvent.findFirst({
          where: {
            pairingId: pairing.id,
            cancelledAt: null,
          },
          orderBy: { createdAt: "desc" },
        });

        const derived = computeDerivedPairingStatus({
          pairingStatus: pairing.status,
          latestMeeting: latestMeeting as any,
        }) as PairingStatusEnum;

        results.push({
          id: pairing.id,
          userAId: pairing.userAId,
          userBId: pairing.userBId,
          status: pairing.status as PairingStatusEnum,
          createdAt: pairing.createdAt,
          userA: pairing.userA as UserType,
          userB: pairing.userB as UserType,
          derivedStatus: derived,
        });
      }

      return results;
    });
  }

  async listReports(identity: Identity): Promise<UserReport[]> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const role = identity.appRole as UserRoleEnum | undefined;
      const isSuperAdmin = role === UserRoleEnum.super_admin;
      const isOrgAdmin = role === UserRoleEnum.org_admin;

      if (!isSuperAdmin && !isOrgAdmin) {
        throw new ForbiddenException(
          "Only organization administrators can view reports"
        );
      }

      const organizationId = isSuperAdmin
        ? undefined
        : await this.getOrganizationIdForIdentity(identity, tx);

      if (!isSuperAdmin && !organizationId) {
        throw new ForbiddenException("Organization context is missing");
      }

      return this.reportRepository.listReports(
        { organizationId: organizationId },
        tx
      );
    });
  }

  async getReportById(
    identity: Identity,
    reportId: string
  ): Promise<UserReport> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const role = identity.appRole as UserRoleEnum | undefined;
      const isSuperAdmin = role === UserRoleEnum.super_admin;
      const isOrgAdmin = role === UserRoleEnum.org_admin;

      if (!isSuperAdmin && !isOrgAdmin) {
        throw new ForbiddenException(
          "Only organization administrators can view reports"
        );
      }

      const report = await this.reportRepository.findById(reportId, tx);

      if (!report) {
        throw new NotFoundException("Report not found");
      }

      if (isOrgAdmin) {
        const organizationId = await this.getOrganizationIdForIdentity(
          identity,
          tx
        );

        if (!organizationId) {
          throw new ForbiddenException("Organization context is missing");
        }

        if (report.reportedUser.organizationId !== organizationId) {
          throw new ForbiddenException(
            "You do not have permission to view this report"
          );
        }
      }

      return report;
    });
  }

  async resolveReport(
    identity: Identity,
    input: { reportId: string; resolutionNote?: string | null }
  ): Promise<UserReport> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const role = identity.appRole as UserRoleEnum | undefined;
      const isSuperAdmin = role === UserRoleEnum.super_admin;
      const isOrgAdmin = role === UserRoleEnum.org_admin;

      if (!isSuperAdmin && !isOrgAdmin) {
        throw new ForbiddenException(
          "Only organization administrators can resolve reports"
        );
      }

      const report = await this.reportRepository.findById(input.reportId, tx);

      if (!report) {
        throw new NotFoundException("Report not found");
      }

      if (isOrgAdmin) {
        const organizationId = await this.getOrganizationIdForIdentity(
          identity,
          tx
        );

        if (!organizationId) {
          throw new ForbiddenException("Organization context is missing");
        }

        if (report.reportedUser.organizationId !== organizationId) {
          throw new ForbiddenException(
            "You do not have permission to resolve this report"
          );
        }
      }

      if (report.status === ReportStatusEnum.resolved) {
        return report;
      }

      return this.reportRepository.resolveReport(
        report.id,
        {
          resolvedById: identity.id,
          resolutionNote: input.resolutionNote ?? null,
        },
        tx
      );
    });
  }

  async reportUser(
    identity: Identity,
    input: { reportedUserId: string; reason: string }
  ): Promise<UserReport> {
    const trimmedReason = input.reason?.trim();

    if (!trimmedReason) {
      throw new BadRequestException("Report reason is required");
    }

    if (identity.id === input.reportedUserId) {
      throw new BadRequestException("You cannot report yourself");
    }

    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const reportedUser = await this.userRepository.getUserById(
        input.reportedUserId,
        tx
      );

      if (!reportedUser) {
        throw new NotFoundException("UserType not found");
      }

      const canView = await this.authorizationService.canViewUser(
        identity,
        reportedUser.id,
        reportedUser.organizationId
      );
      this.authorizationService.throwIfNoPermission(canView);

      const existingReport = await tx.report.findFirst({
        where: {
          reporterId: identity.id,
          reportedUserId: reportedUser.id,
        },
      });

      if (existingReport) {
        throw new ConflictException("You have already reported this user");
      }

      const pairing = await this.findMostRecentPairingBetweenUsers(
        identity.id,
        reportedUser.id,
        tx
      );

      if (!pairing) {
        throw new BadRequestException(
          "You can only report users you have been paired with"
        );
      }

      const report = await tx.report.create({
        data: {
          reporterId: identity.id,
          reportedUserId: reportedUser.id,
          pairingId: pairing.id,
          reason: trimmedReason,
        },
      });

      await this.ensureUserBlock(identity.id, reportedUser.id, tx);

      const fullReport = await this.reportRepository.findById(report.id, tx);

      if (!fullReport) {
        throw new NotFoundException("Report not found after creation");
      }

      return fullReport;
    });
  }

  async banUser(
    identity: Identity,
    input: {
      userId: string;
      reason: string;
      expiresAt?: Date | null;
    }
  ): Promise<UserType> {
    const trimmedReason = input.reason?.trim();

    if (!trimmedReason) {
      throw new BadRequestException("Ban reason is required");
    }

    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const user = await this.userRepository.getUserById(input.userId, tx);

      if (!user) {
        throw new NotFoundException("UserType not found");
      }

      const canManage = await this.authorizationService.canUpdateUser(
        identity,
        user.id,
        user.organizationId
      );
      this.authorizationService.throwIfNoPermission(canManage);

      const ban = await this.userBanRepository.createBan(
        {
          userId: user.id,
          organizationId: user.organizationId,
          reason: trimmedReason,
          expiresAt: input.expiresAt ?? null,
          bannedById: identity.id,
        },
        tx
      );

      const updatedUser = await this.userRepository.updateUser(
        user.id,
        {
          profileStatus: ProfileStatusEnum.suspended,
          isActive: false,
        },
        tx
      );

      await this.sendBanEmail(updatedUser, trimmedReason, input.expiresAt);

      return {
        ...updatedUser,
        activeBan: ban,
      };
    });
  }

  async unbanUser(identity: Identity, userId: string): Promise<UserType> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const user = await this.userRepository.getUserById(userId, tx);

      if (!user) {
        throw new NotFoundException("UserType not found");
      }

      const canManage = await this.authorizationService.canUpdateUser(
        identity,
        user.id,
        user.organizationId
      );
      this.authorizationService.throwIfNoPermission(canManage);

      const activeBan = await this.userBanRepository.findActiveBanByUserId(
        user.id,
        tx
      );

      if (!activeBan) {
        throw new BadRequestException("User is not currently banned");
      }

      await this.userBanRepository.resolveActiveBanForUser(user.id, tx);

      const updatedUser = await this.userRepository.updateUser(
        user.id,
        {
          profileStatus: ProfileStatusEnum.active,
          isActive: true,
        },
        tx
      );

      await this.sendUnbanEmail(updatedUser);

      return {
        ...updatedUser,
        activeBan: null,
      };
    });
  }

  private async getReportedUserIdsForUser(
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<Set<string>> {
    const reports = await tx.report.findMany({
      where: { reporterId: userId },
      select: { reportedUserId: true },
    });

    return new Set(reports.map((report) => report.reportedUserId));
  }

  private async getOrganizationIdForIdentity(
    identity: Identity,
    tx: Prisma.TransactionClient
  ): Promise<string | null> {
    if (identity.organizationId) {
      return identity.organizationId;
    }

    const user = await this.userRepository.getUserById(identity.id, tx);
    return user?.organizationId ?? null;
  }

  private async getBlockedUserIdsForUser(
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<Set<string>> {
    const blocks = await tx.userBlock.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: {
        blockerId: true,
        blockedId: true,
      },
    });

    const blockedUserIds = new Set<string>();
    blocks.forEach((block) => {
      if (block.blockerId === userId) {
        blockedUserIds.add(block.blockedId);
      }
      if (block.blockedId === userId) {
        blockedUserIds.add(block.blockerId);
      }
    });

    return blockedUserIds;
  }

  private async ensureUserBlock(
    blockerId: string,
    blockedId: string,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    if (blockerId === blockedId) {
      return;
    }

    await tx.userBlock.upsert({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
      update: {},
      create: {
        blockerId,
        blockedId,
      },
    });
  }

  private async findMostRecentPairingBetweenUsers(
    userAId: string,
    userBId: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.pairing.findFirst({
      where: {
        OR: [
          { userAId, userBId },
          { userAId: userBId, userBId: userAId },
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  private async sendBanEmail(
    user: { email?: string | null; firstName?: string | null },
    reason: string,
    expiresAt?: Date | null
  ): Promise<void> {
    if (!user.email) {
      return;
    }

    const normalizedExpiry =
      expiresAt instanceof Date
        ? expiresAt
        : expiresAt
          ? new Date(expiresAt)
          : null;

    const template = buildBanEmail({
      reason,
      expiresAt: normalizedExpiry,
      siteUrl: this.config.frontendBaseUrl ?? this.config.baseUrl,
      greeting: (`Hello ${user.firstName ?? ""}`).trim() || "Hello",
    });

    await this.emailService.sendMail({
      to: user.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  private async sendUnbanEmail(
    user: { email?: string | null; firstName?: string | null }
  ): Promise<void> {
    if (!user.email) {
      return;
    }

    const template = buildUnbanEmail({
      siteUrl: this.config.frontendBaseUrl ?? this.config.baseUrl,
      greeting: (`Hello ${user.firstName ?? ""}`).trim() || "Hello",
    });

    await this.emailService.sendMail({
      to: user.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }
}
