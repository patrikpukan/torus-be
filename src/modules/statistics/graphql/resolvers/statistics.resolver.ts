import { Args, Query, Resolver } from "@nestjs/graphql";
import { RequireRole } from "src/shared/auth/decorators/require-role.decorator";
import { User } from "src/shared/auth/decorators/user.decorator";
import type { Identity } from "src/shared/auth/domain/identity";
import { UserRole } from "src/shared/auth/services/authorization.service";
import { StatisticsService } from "../../services/statistics.service";
import { StatisticsFilterInputType } from "../types/statistics-filter-input.type";
import { StatisticsResponseType } from "../types/statistics-response.type";

@Resolver()
export class StatisticsResolver {
  constructor(private readonly statisticsService: StatisticsService) {}

  @RequireRole(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @Query(() => StatisticsResponseType)
  async statistics(
    @User() identity: Identity,
    @Args("filter", { nullable: true }) filter?: StatisticsFilterInputType
  ): Promise<StatisticsResponseType> {
    // If org_admin, restrict to their organization
    const effectiveFilter: StatisticsFilterInputType = {
      ...filter,
      ...(identity.appRole === UserRole.ORG_ADMIN && identity.organizationId
        ? { organizationId: identity.organizationId }
        : {}),
    };

    return this.statisticsService.getStatistics(identity, effectiveFilter);
  }
}
