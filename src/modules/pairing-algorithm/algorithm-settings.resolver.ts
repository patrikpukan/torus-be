import { Args, Context, Mutation, Query, Resolver, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AlgorithmSettingsResponse, AlgorithmSettingsType } from './types/algorithm-settings.type';
import { UpdateAlgorithmSettingsInput } from './types/update-algorithm-settings.input';
import { AlgorithmSettingsService } from './services/algorithm-settings.service';
import { UserContextService, ResolvedUser } from '../../shared/auth/services/user-context.service';
import { AuthenticatedUserGuard } from '../../shared/auth/guards/authenticated-user.guard';
import { PoliciesGuard } from '../../shared/auth/guards/policies.guard';
import { CheckPolicies } from '../../shared/auth/decorators/check-policies.decorator';
import { User } from '../../shared/auth/decorators/user.decorator';
import type { Identity } from '../../shared/auth/domain/identity';

@Resolver(() => AlgorithmSettingsType)
export class AlgorithmSettingsResolver {
  constructor(
    private readonly algorithmSettingsService: AlgorithmSettingsService,
    private readonly userContextService: UserContextService,
  ) {}

  /**
   * Updates algorithm settings for an organization.
   * Requires ability to manage AlgorithmSettings via CASL policy.
   * Organization admins and super admins have this permission.
   */
  @UseGuards(AuthenticatedUserGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can('manage', 'AlgorithmSettings'))
  @Mutation(() => AlgorithmSettingsResponse)
  async updateAlgorithmSettings(
    @User() identity: Identity,
    @Args('input') input: UpdateAlgorithmSettingsInput,
  ): Promise<AlgorithmSettingsResponse> {
    // Cast Identity to ResolvedUser - both have required id, role, and organizationId
    const user: ResolvedUser = {
      id: identity.id,
      organizationId: identity.organizationId,
      role: identity.role,
      appRole: identity.appRole,
    };
    return this.algorithmSettingsService.updateSettings(input, user);
  }

  /**
   * Retrieves algorithm settings for an organization, creating defaults if needed.
   * Accessible to org admins and super admins.
   */
  @UseGuards(AuthenticatedUserGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can('read', 'AlgorithmSettings'))
  @Query(() => AlgorithmSettingsType)
  async getAlgorithmSettings(
    @Args('organizationId', { type: () => ID }) organizationId: string,
  ): Promise<AlgorithmSettingsType> {
    return this.algorithmSettingsService.getOrCreateSettings(organizationId);
  }
}

