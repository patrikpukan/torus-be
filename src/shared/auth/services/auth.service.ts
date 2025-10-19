import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { Request } from 'express';
import type { BetterAuth } from '../providers/better-auth.provider';
import { InjectBetterAuth } from '../providers/better-auth.provider';
import { Config } from '../../config/config.service';
import { UserRepository } from 'src/modules/users/repositories/user.repository';
import {
  ProfileStatusEnum,
  User,
  UserRoleEnum,
} from 'src/modules/users/domain/user';
import { OrgAdminRepository } from '../repositories/org-admin.repository';
import { getSessionFromRequest } from '../utils/get-session-from-request';
import { SupabaseAdminService } from './supabase-admin.service';

export interface StandardResponse<T> {
  success: boolean;
  statusCode: number;
  message?: string;
  data?: T;
}

export interface AuthHandlerResult<T> {
  statusCode: number;
  body: StandardResponse<T>;
  headers?: Headers | null;
}

export interface SignUpPayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  password: string;
  token: string;
}

export interface VerifyEmailPayload {
  token: string;
}

export interface SignUpResponse {
  authUser: unknown;
  profile: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    profileStatus: ProfileStatusEnum;
  };
  primaryRole: UserRoleEnum;
  token?: string | null;
}

export interface SignInResponse {
  session: unknown;
  profile: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    profileStatus: ProfileStatusEnum;
  };
  primaryRole: UserRoleEnum;
}

export interface SessionResponse {
  session: unknown;
  profile?: SignUpResponse['profile'];
  primaryRole: UserRoleEnum;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectBetterAuth private readonly betterAuth: BetterAuth,
    private readonly config: Config,
    private readonly userRepository: UserRepository,
    private readonly orgAdminRepository: OrgAdminRepository,
    private readonly supabaseAdminService: SupabaseAdminService,
  ) {}

  async signUp(
    req: Request,
    payload: SignUpPayload,
  ): Promise<AuthHandlerResult<SignUpResponse>> {
    const { email, password, firstName, lastName } = payload;
    const username = payload.username?.trim();

    if (!email || !password) {
      throw new BadRequestException('Email and password are required.');
    }

    if (username) {
      const existingUsername = await this.userRepository.getUserByUserName(
        username,
      );

      if (existingUsername) {
        throw new ConflictException('Username already exists.');
      }
    }

    const displayName = this.buildDisplayName({
      firstName,
      lastName,
      fallback: email,
    });

    const signUpResult = await this.callAuthEndpoint<{ user: unknown; token?: string | null }>(
      this.betterAuth.api.signUpEmail({
        body: {
          email,
          password,
          name: displayName,
        },
        headers: fromNodeHeaders(req.headers),
        asResponse: true,
      }) as Promise<Response>,
    );

  let supabaseAuthId: string | undefined;

    if (this.supabaseAdminService.isEnabled()) {
      try {
        const supabaseResult = await this.supabaseAdminService.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            betterAuthUserId: (signUpResult.data.user as { id?: string } | undefined)?.id ?? null,
          },
        });

        if (supabaseResult.error) {
          this.logAuthError('Supabase auth user creation error', supabaseResult.error);
        } else {
          supabaseAuthId = supabaseResult.data?.user?.id ?? undefined;
        }
      } catch (error) {
        this.logAuthError('Supabase auth user creation failed', error);
      }
    }

    const createdUser = await this.userRepository.getUserByEmail(email);

    if (!createdUser) {
      throw new InternalServerErrorException(
        'User record is missing after sign-up completion.',
      );
    }

    const primaryRole = await this.resolvePrimaryRole(email);

    const updatedUser = await this.userRepository.updateUser(createdUser.id, {
      name: displayName,
      username,
      role: primaryRole,
      profileStatus: ProfileStatusEnum.pending,
      supabaseUserId: supabaseAuthId ?? createdUser.supabaseUserId,
    });

    const responsePayload: SignUpResponse = {
      authUser: signUpResult.data.user,
      token: signUpResult.data.token ?? null,
      primaryRole,
      profile: this.mapUserToProfile(updatedUser),
    };

    return {
      statusCode: 201,
      headers: signUpResult.headers,
      body: {
        success: true,
        statusCode: 201,
        data: responsePayload,
      },
    };
  }

  async signIn(
    req: Request,
    payload: SignInPayload,
  ): Promise<AuthHandlerResult<SignInResponse>> {
    const { email, password } = payload;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required.');
    }

    const signInResult = await this.callAuthEndpoint<{ session: unknown }>(
      this.betterAuth.api.signInEmail({
        body: { email, password },
        headers: fromNodeHeaders(req.headers),
        asResponse: true,
      }) as Promise<Response>,
    );

    const user = await this.userRepository.getUserByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Unable to locate user for supplied email.');
    }

    const responsePayload: SignInResponse = {
      session: signInResult.data.session,
      primaryRole: user.role,
      profile: this.mapUserToProfile(user),
    };

    return {
      statusCode: 200,
      headers: signInResult.headers,
      body: {
        success: true,
        statusCode: 200,
        data: responsePayload,
      },
    };
  }

  async signOut(req: Request): Promise<AuthHandlerResult<null>> {
    const result = await this.callAuthEndpoint<unknown>(
      this.betterAuth.api.signOut({
        headers: fromNodeHeaders(req.headers),
        asResponse: true,
      }) as Promise<Response>,
    );

    return {
      statusCode: result.statusCode,
      headers: result.headers,
      body: {
        success: true,
        statusCode: result.statusCode,
        message: 'Signed out successfully.',
      },
    };
  }

  async currentSession(req: Request): Promise<AuthHandlerResult<SessionResponse>> {
    const session = await getSessionFromRequest(req as any, this.betterAuth);

    if (!session) {
      throw new UnauthorizedException('No active session.');
    }

    const email = (session as any)?.user?.email as string | undefined;
    let user: User | null = null;

    if (email) {
      user = await this.userRepository.getUserByEmail(email);
    }

    const primaryRole = user
      ? user.role
      : await this.resolvePrimaryRole(email ?? '');

    const responsePayload: SessionResponse = {
      session,
      primaryRole,
      profile: user ? this.mapUserToProfile(user) : undefined,
    };

    return {
      statusCode: 200,
      body: {
        success: true,
        statusCode: 200,
        data: responsePayload,
      },
    };
  }

  async forgotPassword(
    req: Request,
    payload: ForgotPasswordPayload,
  ): Promise<AuthHandlerResult<null>> {
    const { email } = payload;

    if (!email) {
      throw new BadRequestException('Email is required.');
    }

    const resetUrl = this.buildPasswordResetUrl();

    const result = await this.callAuthEndpoint<unknown>(
      this.betterAuth.api.requestPasswordReset({
        body: {
          email,
          redirectTo: resetUrl,
        },
        headers: fromNodeHeaders(req.headers),
        asResponse: true,
      }) as Promise<Response>,
    );

    return {
      statusCode: result.statusCode,
      headers: result.headers,
      body: {
        success: true,
        statusCode: result.statusCode,
        message: 'Password reset email sent.',
      },
    };
  }

  async resetPassword(
    req: Request,
    payload: ResetPasswordPayload,
  ): Promise<AuthHandlerResult<null>> {
    const { password, token } = payload;

    if (!password || !token) {
      throw new BadRequestException('Token and new password are required.');
    }

    const result = await this.callAuthEndpoint<unknown>(
      this.betterAuth.api.resetPassword({
        body: { newPassword: password, token } as any,
        headers: fromNodeHeaders(req.headers),
        asResponse: true,
      }) as Promise<Response>,
    );

    return {
      statusCode: result.statusCode,
      headers: result.headers,
      body: {
        success: true,
        statusCode: result.statusCode,
        message: 'Password has been reset.',
      },
    };
  }

  async verifyEmail(
    req: Request,
    payload: VerifyEmailPayload,
  ): Promise<AuthHandlerResult<unknown>> {
    const { token } = payload;

    if (!token) {
      throw new BadRequestException('Verification token is required.');
    }

    const result = await this.callAuthEndpoint<unknown>(
      this.betterAuth.api.verifyEmail({
        query: { token },
        headers: fromNodeHeaders(req.headers),
        asResponse: true,
      }) as Promise<Response>,
    );

    return {
      statusCode: result.statusCode,
      headers: result.headers,
      body: {
        success: true,
        statusCode: result.statusCode,
        data: result.data,
      },
    };
  }

  private buildDisplayName(params: {
    firstName?: string;
    lastName?: string;
    fallback: string;
  }): string {
    const parts = [params.firstName, params.lastName]
      .filter((value) => Boolean(value && value.trim()))
      .map((value) => value!.trim());

    if (parts.length === 0) {
      const [local] = params.fallback.split('@');
      return local ?? params.fallback;
    }

    return parts.join(' ');
  }

  private mapUserToProfile(user: User): SignUpResponse['profile'] {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.name,
      profileStatus: user.profileStatus,
    };
  }

  private async resolvePrimaryRole(email: string): Promise<UserRoleEnum> {
    const normalizedEmail = (email ?? '').toLowerCase();

    if (!normalizedEmail) {
      return UserRoleEnum.user;
    }

    if (
      this.config.superadminEmail &&
      this.config.superadminEmail.toLowerCase() === normalizedEmail
    ) {
      return UserRoleEnum.systemAdmin;
    }

    if (await this.orgAdminRepository.isOrgAdmin(normalizedEmail)) {
      return UserRoleEnum.orgAdmin;
    }

    return UserRoleEnum.user;
  }

  isSystemAdmin(role?: string | null): boolean {
    return role === UserRoleEnum.systemAdmin;
  }

  async isOrgAdmin(role: string | null | undefined, email?: string): Promise<boolean> {
    if (role === UserRoleEnum.orgAdmin) {
      return true;
    }

    if (!email) {
      return false;
    }

    return this.orgAdminRepository.isOrgAdmin(email);
  }

  private buildPasswordResetUrl(): string {
    const base = this.config.frontendBaseUrl.replace(/\/$/, '');
    const resetPath = this.config.frontendResetPasswordUrl.replace(/^\//, '');

    return `${base}/${resetPath}`;
  }

  private async callAuthEndpoint<T>(
    responsePromise: Promise<Response>,
  ): Promise<{ data: T; headers: Headers | null; statusCode: number }> {
    let response: Response;

    try {
      response = await responsePromise;
    } catch (error) {
      this.logAuthError('Auth provider request failed before response', error);
      throw new InternalServerErrorException('Authentication provider unavailable.');
    }
    const headers = response.headers ?? null;
    const statusCode = response.status;
    const payload = await this.safeJson<T>(response);

    if (!response.ok) {
      const message =
        (payload && (payload as any)?.message) ||
        (payload as any)?.error ||
        response.statusText ||
        'Authentication request failed.';

      if (statusCode === 401) {
        throw new UnauthorizedException(message);
      }

      if (statusCode === 409) {
        throw new ConflictException(message);
      }

      throw new BadRequestException(message);
    }

    return {
      data: payload,
      headers,
      statusCode,
    };
  }

  private logAuthError(context: string, error: unknown): void {
    // eslint-disable-next-line no-console
    console.error(`[AUTH] ${context}:`, error);
  }

  private async safeJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch (error) {
      return {} as T;
    }
  }
}
