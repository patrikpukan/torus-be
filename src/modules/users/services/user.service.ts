import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { BetterAuth } from 'src/shared/auth/providers/better-auth.provider';
import { InjectBetterAuth } from 'src/shared/auth/providers/better-auth.provider';
import { AbilityFactory } from 'src/shared/permissions/factory/ability.factory';
import { Identity } from '../../../shared/auth/domain/identity';
import { CurrentUser, User, UserRoleEnum } from '../domain/user';
import { UserRepository } from '../repositories/user.repository';
import { SupabaseAdminService } from 'src/shared/auth/services/supabase-admin.service';

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
    private readonly abilityFactory: AbilityFactory,
    @InjectBetterAuth private readonly betterAuth: BetterAuth,
    private readonly supabaseAdminService: SupabaseAdminService,
  ) {}

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.getUserById(id);
  }

  async getCurrentUser(identity: Identity): Promise<CurrentUser | null> {
    return this.userRepository.getUserWithOrganizationById(identity.id);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.userRepository.getUserByUserName(username);
  }

  async listUsers(
    identity: Identity,
    params?: { offset?: number; limit?: number },
  ): Promise<User[]> {
    const ability = this.abilityFactory.createForUser(identity);

    if (!ability.canReadUsers()) {
      throw new ForbiddenException();
    }

    return this.userRepository.listUsers({
      offset: params?.offset,
      limit: params?.limit,
    });
  }

  // Creation of users is handled via signUp (BetterAuth) flow.

  async deleteUserById(identity: Identity, id: string): Promise<User> {
    const ability = this.abilityFactory.createForUser(identity);

    const user = await this.userRepository.getUserById(id);

    if (!user) {
      throw new NotFoundException();
    }

    if (!ability.canDeleteUser(user)) {
      throw new ForbiddenException();
    }

    return this.userRepository.deleteUserById(id);
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
    },
  ): Promise<User> {
    const ability = this.abilityFactory.createForUser(identity);

    const user = await this.userRepository.getUserById(id);

    if (!user) {
      throw new NotFoundException();
    }

    if (!ability.canUpdateUser(user)) {
      throw new ForbiddenException();
    }

    return this.userRepository.updateUser(id, data);
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
    },
  ): Promise<CurrentUser> {
    const ability = this.abilityFactory.createForUser(identity);

    const existingUser = await this.userRepository.getUserWithOrganizationById(
      identity.id,
    );

    if (!existingUser) {
      throw new NotFoundException();
    }

    if (!ability.canUpdateUser(existingUser)) {
      throw new ForbiddenException();
    }

    await this.userRepository.updateUser(identity.id, {
      firstName: data.firstName,
      lastName: data.lastName,
      about: data.about,
      hobbies: data.hobbies,
      preferredActivity: data.preferredActivity,
      interests: data.interests,
      profileImageUrl:
        typeof data.avatarUrl !== 'undefined' ? data.avatarUrl : undefined,
    });

    const updatedUser = await this.userRepository.getUserWithOrganizationById(
      identity.id,
    );

    if (!updatedUser) {
      throw new NotFoundException();
    }

    return updatedUser;
  }

  async signUp(
    data: {
      email: string;
      password: string;
      username: string;
      firstName?: string | null;
      lastName?: string | null;
    },
    profilePicture?: Promise<FileUpload>,
  ): Promise<User> {
    // Check if username already exists
    const existingUser = await this.userRepository.getUserByUserName(
      data.username,
    );
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    // Create user with BetterAuth using the correct API structure
    const betterAuthResult = await this.betterAuth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: [data.firstName, data.lastName].filter((part) => !!part && part.trim().length > 0).join(' ').trim() || data.username || data.email,
      },
    });

  let supabaseAuthId: string | undefined;

    if (this.supabaseAdminService.isEnabled()) {
      try {
        const supabaseResult = await this.supabaseAdminService.createUser({
          email: data.email,
          password: data.password,
          email_confirm: true,
          user_metadata: {
            betterAuthUserId: (betterAuthResult as { user?: { id?: string } } | undefined)?.user?.id ?? null,
          },
        });

        if (supabaseResult.error) {
          this.logger.error(
            `Supabase auth user creation error: ${supabaseResult.error.message}`,
            supabaseResult.error.stack,
          );
        } else {
          supabaseAuthId = supabaseResult.data?.user?.id ?? undefined;
        }
      } catch (error) {
        const err = error as Error;
        this.logger.error('Supabase auth user creation failed', err.stack ?? err.message);
      }
    }

    // Find the newly created user by email
    const newUser = await this.userRepository.getUserByEmail(data.email);

    if (!newUser) {
      throw new BadRequestException('Failed to create user');
    }

    // Update the user with the username and role
    await this.userRepository.updateUser(newUser.id, {
      username: data.username,
      role: UserRoleEnum.user,
      supabaseUserId: supabaseAuthId ?? newUser.supabaseUserId,
      firstName: data.firstName,
      lastName: data.lastName,
    });

    // Handle profile picture if it exists
    if (profilePicture) {
      try {
        const file = await profilePicture;
        const uploadDir = path.join(
          process.cwd(),
          'uploads',
          'profile-pictures',
        );

        // Ensure the upload directory exists
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Generate a unique filename
        const fileExtension = file.filename.split('.').pop();
        const fileName = `${newUser.id}.${fileExtension}`;
        const filePath = path.join(uploadDir, fileName);

        // Create a write stream
        const writeStream = fs.createWriteStream(filePath);

        // Use pipeline for proper error handling during stream operations
        await pipeline(file.createReadStream(), writeStream);

        // Update user with profile picture path
        await this.userRepository.updateUser(newUser.id, {
          profileImageUrl: `/uploads/profile-pictures/${fileName}`,
        });
      } catch (error) {
        console.error('Error uploading profile picture:', error);
        throw new BadRequestException('Failed to upload profile picture');
      }
    }

    // Return the created user
    return this.userRepository.getUserById(newUser.id) as Promise<User>;
  }
}
