import { UseGuards } from "@nestjs/common";
import { Query, Resolver } from "@nestjs/graphql";
import { AuthenticatedUserGuard } from "../../shared/auth/guards/authenticated-user.guard";
import { User } from "../../shared/auth/decorators/user.decorator";
import type { Identity } from "../../shared/auth/domain/identity";
import { PairingPeriodType } from "./pairing-period.type";
import { PairingPeriodService } from "./pairing-period.service";

@Resolver(() => PairingPeriodType)
export class PairingPeriodResolver {
  constructor(private readonly pairingPeriodService: PairingPeriodService) {}

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => PairingPeriodType, { nullable: true })
  async activePairingPeriod(
    @User() user: Identity | null
  ): Promise<PairingPeriodType | null> {
    const activePeriod =
      await this.pairingPeriodService.getActivePairingPeriodForUser(user);

    if (!activePeriod || !activePeriod.startDate) {
      return null;
    }

    return {
      id: activePeriod.id,
      organizationId: activePeriod.organizationId,
      startDate: activePeriod.startDate,
      endDate: activePeriod.endDate,
      status: activePeriod.status,
    };
  }
}
