import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AlgorithmSettingsResponse, AlgorithmSettingsType } from './types/algorithm-settings.type';
import { UpdateAlgorithmSettingsInput } from './types/update-algorithm-settings.input';
import { AlgorithmSettingsService } from './services/algorithm-settings.service';
import { UserContextService } from '../../shared/auth/services/user-context.service';

@Resolver(() => AlgorithmSettingsType)
export class AlgorithmSettingsResolver {
  constructor(
    private readonly algorithmSettingsService: AlgorithmSettingsService,
    private readonly userContextService: UserContextService,
  ) {}

  /**
   * Updates algorithm settings for an organization.
   * Requires admin access.
   */
  @Mutation(() => AlgorithmSettingsResponse)
  async updateAlgorithmSettings(
    @Args('input') input: UpdateAlgorithmSettingsInput,
    @Context() context: any,
  ): Promise<AlgorithmSettingsResponse> {
    const user = await this.userContextService.resolveCurrentUser(context);
    return this.algorithmSettingsService.updateSettings(input, user);
  }

  /**
   * Retrieves algorithm settings for an organization, creating defaults if needed.
   */
  @Query(() => AlgorithmSettingsType)
  async getAlgorithmSettings(
    @Args('organizationId') organizationId: string,
  ): Promise<AlgorithmSettingsType> {
    return this.algorithmSettingsService.getOrCreateSettings(organizationId);
  }
}
