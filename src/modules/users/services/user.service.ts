import * as fs from "fs";
import * as path from "path";
import { pipeline } from "stream/promises";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { CurrentUser, User, UserRoleEnum } from "../domain/user";
import { UserRepository } from "../repositories/user.repository";
import { Identity } from "src/shared/auth/domain/identity";
import { PrismaService } from "src/core/prisma/prisma.service";
import { withRls } from "src/db/withRls";
import { getRlsClaims } from "src/shared/auth/utils/get-rls-claims";
import { SupabaseAdminService } from "src/shared/auth/supabase-admin.service";
import { PairingStatusEnum } from "../graphql/types/pairing-history.type";

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
    private readonly prisma: PrismaService,
    private readonly supabaseAdminService: SupabaseAdminService
  ) {}

  async getUserById(identity: Identity, id: string): Promise<User | null> {
    return withRls(this.prisma, getRlsClaims(identity), (tx) =>
      this.userRepository.getUserById(id, tx)
    );
  }

  async getCurrentUser(identity: Identity): Promise<CurrentUser | null> {
    return withRls(this.prisma, getRlsClaims(identity), (tx) =>
      this.userRepository.getUserWithOrganizationById(identity.id, tx)
    );
  }

  async getUserByUsername(
    identity: Identity,
    username: string
  ): Promise<User | null> {
    return withRls(this.prisma, getRlsClaims(identity), (tx) =>
      this.userRepository.getUserByUserName(username, tx)
    );
  }

  async listUsers(identity: Identity): Promise<User[]> {
    return withRls(this.prisma, getRlsClaims(identity), (tx) =>
      this.userRepository.listUsers(tx)
    );
  }

  // Creation of users is handled via signUp (BetterAuth) flow.

  async deleteUserById(identity: Identity, id: string): Promise<User> {
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
      username?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      about?: string | null;
      hobbies?: string | null;
      preferredActivity?: string | null;
      interests?: string | null;
      isActive?: boolean;
      suspendedUntil?: Date | null;
      displayUsername?: string | null;
    }
  ): Promise<User> {
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
      hobbies?: string | null;
      preferredActivity?: string | null;
      interests?: string | null;
      avatarUrl?: string | null;
      displayUsername?: string | null;
    }
  ): Promise<CurrentUser> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const existingUser =
        await this.userRepository.getUserWithOrganizationById(identity.id, tx);

      if (!existingUser) {
        throw new NotFoundException();
      }

      await this.userRepository.updateUser(
        identity.id,
        {
          firstName: data.firstName,
          lastName: data.lastName,
          about: data.about,
          hobbies: data.hobbies,
          preferredActivity: data.preferredActivity,
          interests: data.interests,
          profileImageUrl:
            typeof data.avatarUrl !== "undefined" ? data.avatarUrl : undefined,
          displayUsername: data.displayUsername,
        },
        tx
      );

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
      username: string;
      firstName?: string | null;
      lastName?: string | null;
      organizationId?: string; // Add organization ID parameter
    },
    profilePicture?: Promise<FileUpload>
  ): Promise<User> {
    const existingUser = await this.userRepository.getUserByUserName(
      data.username
    );
    if (existingUser) {
      throw new ConflictException("Username already exists");
    }

    let supabaseAuthId: string | undefined;

    if (this.supabaseAdminService.isEnabled()) {
      try {
        const supabaseResult = await this.supabaseAdminService.createUser({
          email: data.email,
          password: data.password,
          email_confirm: true,
          user_metadata: {
            username: data.username,
            first_name: data.firstName ?? undefined,
            last_name: data.lastName ?? undefined,
            organization_id: data.organizationId ?? undefined, // Pass org ID to Supabase
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

    const newUser = await this.userRepository.getUserByEmail(data.email);

    if (!newUser) {
      throw new BadRequestException("Failed to create user");
    }

    await this.userRepository.updateUser(newUser.id, {
      username: data.username,
      role: UserRoleEnum.user,
      supabaseUserId: supabaseAuthId ?? newUser.supabaseUserId,
      firstName: data.firstName,
      lastName: data.lastName,
    });

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

    return this.userRepository.getUserById(newUser.id) as Promise<User>;
  }

  /**
   * Get all users that the current user has been paired with historically.
   * Returns distinct users from all pairings (both as userA and userB).
   */
  async getPairedUsers(identity: Identity): Promise<User[]> {
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

      // Extract paired users (remove duplicates)
      const pairedUserIds = new Set<string>();
      const pairedUsers: User[] = [];

      for (const pairing of pairings) {
        const pairedUserId =
          pairing.userAId === identity.id ? pairing.userBId : pairing.userAId;
        const pairedUser =
          pairing.userAId === identity.id ? pairing.userB : pairing.userA;

        if (!pairedUserIds.has(pairedUserId)) {
          pairedUserIds.add(pairedUserId);
          pairedUsers.push(pairedUser as User);
        }
      }

      return pairedUsers;
    });
  }

  /**
   * Get pairing history for current user with detailed pairing information.
   * Returns all pairings (both as userA and userB) sorted by creation date (newest first).
   */
  async getPairingHistory(
    identity: Identity
  ): Promise<
    Array<{
      id: string;
      userAId: string;
      userBId: string;
      status: PairingStatusEnum;
      createdAt: Date;
      userA: User;
      userB: User;
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

      return pairings.map((pairing) => ({
        id: pairing.id,
        userAId: pairing.userAId,
        userBId: pairing.userBId,
        status: pairing.status as PairingStatusEnum,
        createdAt: pairing.createdAt,
        userA: pairing.userA as User,
        userB: pairing.userB as User,
      }));
    });
  }
}
