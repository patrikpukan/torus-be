import { BadRequestException, ConflictException } from '@nestjs/common';
import { Headers, Response } from 'undici';
import { Request } from 'express';
import { AuthService, ForgotPasswordPayload, SignInPayload, SignUpPayload } from './auth.service';
import { Config } from '../../config/config.service';
import { UserRepository } from 'src/modules/users/repositories/user.repository';
import { OrgAdminRepository } from '../repositories/org-admin.repository';
import { ProfileStatusEnum, User, UserRoleEnum } from 'src/modules/users/domain/user';

jest.mock('../providers/better-auth.provider', () => ({
  InjectBetterAuth: () => undefined,
}));

describe('AuthService', () => {
  const email = 'fico@example.com';
  const defaultRequest = { headers: {} } as unknown as Request;

  let service: AuthService;
  let betterAuthApi: {
    signUpEmail: jest.Mock;
    signInEmail: jest.Mock;
    signOut: jest.Mock;
    requestPasswordReset: jest.Mock;
    resetPassword: jest.Mock;
    verifyEmail: jest.Mock;
  };
  let userRepository: jest.Mocked<UserRepository>;
  let orgAdminRepository: jest.Mocked<OrgAdminRepository>;
  let config: Config;

  const createResponse = <T>(data: T, status = 200, headerMap: Record<string, string> = {}) => {
    const responseHeaders = new Headers();
    Object.entries(headerMap).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return {
      ok: status >= 200 && status < 300,
      status,
      headers: responseHeaders,
      json: jest.fn().mockResolvedValue(data),
    } as unknown as Response;
  };

  const buildUser = (overrides: Partial<User> = {}): User => ({
    id: overrides.id ?? 'user-1',
    email: overrides.email ?? email,
    name: overrides.name ?? 'Robo Fico',
    username: overrides.username ?? 'milujem',
    role: overrides.role ?? UserRoleEnum.user,
    profileStatus: overrides.profileStatus ?? ProfileStatusEnum.pending,
    createdAt: overrides.createdAt ?? new Date('2025-01-01T00:00:00Z'),
    updatedAt: overrides.updatedAt ?? new Date('2025-01-01T00:00:00Z'),
    profileImageUrl: overrides.profileImageUrl,
  });

  beforeEach(() => {
    betterAuthApi = {
      signUpEmail: jest.fn(),
      signInEmail: jest.fn(),
      signOut: jest.fn(),
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
      verifyEmail: jest.fn(),
    };

    userRepository = {
      getUserByUserName: jest.fn(),
      getUserByEmail: jest.fn(),
      updateUser: jest.fn(),
      getUserById: jest.fn(),
      getUsersByIds: jest.fn(),
      deleteUserById: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    orgAdminRepository = {
      isOrgAdmin: jest.fn(),
      upsertOrgAdmin: jest.fn(),
      removeOrgAdmin: jest.fn(),
    } as unknown as jest.Mocked<OrgAdminRepository>;

    config = {
      superadminEmail: 'admin@example.com',
      frontendBaseUrl: 'http://localhost:3000',
      frontendProdUrl: 'http://localhost:3001',
      frontendResetPasswordUrl: 'reset-password',
    } as Config;

    const betterAuth = { api: betterAuthApi } as unknown as any;

    service = new AuthService(betterAuth, config, userRepository, orgAdminRepository);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('signs up a user and returns profile data', async () => {
    const payload: SignUpPayload = {
      email,
      password: 'Password1!',
      firstName: 'Robo',
      lastName: 'Fico',
      username: 'milujem',
    };

    betterAuthApi.signUpEmail.mockResolvedValue(
      createResponse({ user: { id: 'auth-user' }, token: 'session-token' }, 201, {
        'set-cookie': 'session=session-token; Path=/;',
      }),
    );

    const createdUser = buildUser({ id: 'user-1', username: '' });
    const updatedUser = buildUser({ name: 'Robo Fico', username: 'milujem', role: UserRoleEnum.user });

    userRepository.getUserByUserName.mockResolvedValue(null);
    userRepository.getUserByEmail.mockResolvedValue(createdUser);
    userRepository.updateUser.mockResolvedValue(updatedUser);
    orgAdminRepository.isOrgAdmin.mockResolvedValue(false);

    const result = await service.signUp(defaultRequest, payload);

    expect(result.statusCode).toBe(201);
    expect(result.headers?.get('set-cookie')).toContain('session-token');
    expect(result.body.success).toBe(true);
    expect(result.body.data?.profile.email).toBe(email);
    expect(result.body.data?.profile.username).toBe('milujem');
    expect(userRepository.updateUser).toHaveBeenCalledWith('user-1', {
      name: 'Robo Fico',
      username: 'milujem',
      role: UserRoleEnum.user,
      profileStatus: ProfileStatusEnum.pending,
    });
  });

  it('fails signup when username is taken', async () => {
    const payload: SignUpPayload = {
      email,
      password: 'Password1!',
      username: 'duplicate',
    };

    userRepository.getUserByUserName.mockResolvedValue(buildUser({ username: 'duplicate' }));

    await expect(service.signUp(defaultRequest, payload)).rejects.toBeInstanceOf(ConflictException);
    expect(betterAuthApi.signUpEmail).not.toHaveBeenCalled();
  });

  it('fails signup when email missing', async () => {
    const payload = { password: 'Password1!' } as SignUpPayload;
    await expect(service.signUp(defaultRequest, payload)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signs in user and returns session', async () => {
    const payload: SignInPayload = {
      email,
      password: 'Password1!',
    };

    betterAuthApi.signInEmail.mockResolvedValue(
      createResponse({ session: { id: 'session-1' } }, 200, {
        'set-cookie': 'session=session-1; Path=/;',
      }),
    );

    userRepository.getUserByEmail.mockResolvedValue(
      buildUser({ role: UserRoleEnum.orgAdmin, username: 'milujem' }),
    );

    const result = await service.signIn(defaultRequest, payload);

    expect(result.statusCode).toBe(200);
    expect(result.body.data?.session).toEqual({ id: 'session-1' });
    expect(result.body.data?.primaryRole).toBe(UserRoleEnum.orgAdmin);
    expect(result.headers?.get('set-cookie')).toContain('session-1');
  });

  it('fails signin when email missing', async () => {
    const payload = { password: 'Password1!' } as SignInPayload;
    await expect(service.signIn(defaultRequest, payload)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requests password reset', async () => {
    const payload: ForgotPasswordPayload = { email };
    betterAuthApi.requestPasswordReset.mockResolvedValue(createResponse({}, 200));

    const result = await service.forgotPassword(defaultRequest, payload);

    expect(result.statusCode).toBe(200);
    expect(result.body.message).toBe('Password reset email sent.');
    expect(betterAuthApi.requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email }),
      }),
    );
  });

  it('fails forgot password when email missing', async () => {
    await expect(
      service.forgotPassword(defaultRequest, { email: '' } as ForgotPasswordPayload),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
