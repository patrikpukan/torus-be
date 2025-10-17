import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BetterAuth,
  InjectBetterAuth,
} from 'src/shared/auth/providers/better-auth.provider';
import { AbilityFactory } from 'src/shared/permissions/factory/ability.factory';
import { Identity } from '../../../shared/auth/domain/identity';
import { User, UserRoleEnum } from '../domain/user';
import { UserRepository } from '../repositories/user.repository';

// Define an interface for the file upload
interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => NodeJS.ReadableStream;
}

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly abilityFactory: AbilityFactory,
    @InjectBetterAuth private readonly betterAuth: BetterAuth,
  ) {}

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.getUserById(id);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.userRepository.getUserByUserName(username);
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    return this.userRepository.getUsersByIds(ids);
  }

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
      name?: string;
      email?: string;
      role?: UserRoleEnum;
      profileImageUrl?: string;
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

  async signUp(
    data: {
      email: string;
      password: string;
      name: string;
      username: string;
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
    await this.betterAuth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
      },
    });

    // Find the newly created user by email
    const newUser = await this.userRepository.getUserByEmail(data.email);

    if (!newUser) {
      throw new BadRequestException('Failed to create user');
    }

    // Update the user with the username and role
    await this.userRepository.updateUser(newUser.id, {
      username: data.username,
      role: UserRoleEnum.user,
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
