import { Args, Context, Mutation, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { PairingAlgorithmService } from "./pairing-algorithm.service";
import { PairingExecutionResult } from "./types/pairing-execution-result.type";
import { UserContextService } from "../../shared/auth/services/user-context.service";
import { AuthenticatedUserGuard } from "../../shared/auth/guards/authenticated-user.guard";

@Resolver(() => PairingExecutionResult)
export class PairingAlgorithmResolver {
  constructor(
    private readonly pairingAlgorithmService: PairingAlgorithmService,
    private readonly userContextService: UserContextService
  ) {}

  /**
   * Manually triggers the pairing algorithm for an organization.
   * Requires admin role.
   */
  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => PairingExecutionResult)
  async executePairingAlgorithm(
    @Args("organizationId") organizationId: string,
    @Context() context: any
  ): Promise<PairingExecutionResult> {
    const user = await this.userContextService.resolveCurrentUser(
      context.req.user
    );
    this.userContextService.validateUserIsAdmin(user);
    return this.pairingAlgorithmService.executePairingWithStats(
      organizationId,
      user.id
    );
  }
}
