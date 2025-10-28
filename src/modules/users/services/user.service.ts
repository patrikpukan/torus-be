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

  async listUsers(
    identity: Identity,
    params?: { offset?: number; limit?: number }
  ): Promise<User[]> {
    return withRls(this.prisma, getRlsClaims(identity), (tx) =>
      this.userRepository.listUsers(
        {
          offset: params?.offset,
          limit: params?.limit,
        },
        tx
      )
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
}
