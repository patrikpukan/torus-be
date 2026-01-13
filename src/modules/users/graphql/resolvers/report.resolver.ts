import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthenticatedUserGuard } from "src/shared/auth/guards/authenticated-user.guard";
import { RequireRole } from "src/shared/auth/decorators/require-role.decorator";
import { UserRole } from "src/shared/auth/services/authorization.service";
import { User } from "src/shared/auth/decorators/user.decorator";
import type { Identity } from "src/shared/auth/domain/identity";
import { UserService } from "../../services/user.service";
import { UserReportType } from "../types/user-report.type";
import { ResolveReportInputType } from "../types/resolve-report-input.type";

@Resolver(() => UserReportType)
export class ReportResolver {
  constructor(private readonly userService: UserService) {}

  @UseGuards(AuthenticatedUserGuard)
  @RequireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Query(() => [UserReportType])
  async reports(
    @User() identity: Identity,
    @Args("organizationId", { type: () => ID, nullable: true })
    organizationId?: string
  ): Promise<UserReportType[]> {
    const effectiveOrganizationId =
      identity.appRole === UserRole.ORG_ADMIN && identity.organizationId
        ? identity.organizationId
        : organizationId;

    return this.userService.listReports(identity, effectiveOrganizationId);
  }

  @UseGuards(AuthenticatedUserGuard)
  @RequireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Query(() => UserReportType, { nullable: true })
  async reportById(
    @User() identity: Identity,
    @Args("id", { type: () => ID }) id: string
  ): Promise<UserReportType | null> {
    return this.userService.getReportById(identity, id);
  }

  @UseGuards(AuthenticatedUserGuard)
  @RequireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Mutation(() => UserReportType)
  async resolveReport(
    @User() identity: Identity,
    @Args("input") input: ResolveReportInputType
  ): Promise<UserReportType> {
    return this.userService.resolveReport(identity, {
      reportId: input.reportId,
      resolutionNote: input.resolutionNote,
    });
  }
}
