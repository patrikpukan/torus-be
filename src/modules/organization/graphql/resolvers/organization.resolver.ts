import {
  Args,
  ID,
  Mutation,
  Query,
  Resolver,
  ResolveField,
  Parent,
} from "@nestjs/graphql";
import { OrganizationService } from "../../services/organization.service";
import { InviteCodeService } from "../../services/invite-code.service";
import { DepartmentService } from "../../services/department.service";
import { RegisterOrganizationInputType } from "../types/register-organization-input.type";
import { RegisterOrganizationResponseType } from "../types/register-organization-response.type";
import { Logger, UseGuards } from "@nestjs/common";
import { OrganizationType } from "../types/organization.type";
import { DepartmentType } from "../types/department.type";
import { User } from "src/shared/auth/decorators/user.decorator";
import type { Identity } from "src/shared/auth/domain/identity";
import { AuthenticatedUserGuard } from "src/shared/auth/guards/authenticated-user.guard";
import { OrgAdminGuard } from "src/shared/auth/guards/org-admin.guard";
import { PoliciesGuard } from "src/shared/auth/guards/policies.guard";
import { CheckPolicies } from "src/shared/auth/decorators/check-policies.decorator";
import { UpdateOrganizationInputType } from "../types/update-organization-input.type";
import { InviteUserInputType } from "../types/invite-user-input.type";
import { InviteUserResponseType } from "../types/invite-user-response.type";
import { InviteCodeType } from "../types/invite-code.type";
import { CreateInviteCodeInputType } from "../types/create-invite-code-input.type";
import { CreateInviteCodeResponseType } from "../types/create-invite-code-response.type";
import { InviteCodeValidationResponseType } from "../types/invite-code-validation-response.type";

@Resolver(() => OrganizationType)
export class OrganizationResolver {
  private readonly logger = new Logger(OrganizationResolver.name);

  constructor(
    private readonly organizationService: OrganizationService,
    private readonly inviteCodeService: InviteCodeService,
    private readonly departmentService: DepartmentService
  ) {}

  @UseGuards(AuthenticatedUserGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can("read", "Organization"))
  @Query(() => [OrganizationType])
  async organizations(): Promise<OrganizationType[]> {
    return this.organizationService.listOrganizations();
  }

  @UseGuards(AuthenticatedUserGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can("read", "Organization"))
  @Query(() => OrganizationType, { nullable: true })
  async organizationById(
    @Args("id", { type: () => ID }) id: string
  ): Promise<OrganizationType | null> {
    return this.organizationService.getOrganizationById(id);
  }

  @UseGuards(AuthenticatedUserGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can("read", "Organization"))
  @Query(() => OrganizationType, { nullable: true })
  async myOrganization(
    @User() identity: Identity
  ): Promise<OrganizationType | null> {
    return this.organizationService.getOrganizationByUserId(identity.id);
  }

  @UseGuards(AuthenticatedUserGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can("manage", "Organization"))
  @Mutation(() => OrganizationType)
  async updateOrganization(
    @Args("input") input: UpdateOrganizationInputType
  ): Promise<OrganizationType> {
    return this.organizationService.updateOrganization(input.id, {
      name: input.name,
      size: input.size,
      address: input.address,
      imageUrl: input.imageUrl,
    });
  }

  @UseGuards(AuthenticatedUserGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can("manage", "InviteCode"))
  @Mutation(() => InviteUserResponseType)
  async inviteUserToOrganization(
    @Args("input") input: InviteUserInputType
  ): Promise<InviteUserResponseType> {
    const result = await this.organizationService.inviteUserToOrganization(
      input.email,
      input.organizationId
    );

    return {
      success: result.success,
      message: result.message,
      userId: result.userId,
    };
  }

  @Mutation(() => RegisterOrganizationResponseType)
  async registerOrganization(
    @Args("input") input: RegisterOrganizationInputType
  ): Promise<RegisterOrganizationResponseType> {
    this.logger.log(
      `Registering organization: ${input.organizationName} for admin: ${input.adminEmail}`
    );

    const result = await this.organizationService.registerOrganization({
      adminEmail: input.adminEmail,
      organizationName: input.organizationName,
      organizationSize: input.organizationSize,
      organizationAddress: input.organizationAddress,
    });

    return {
      organization: result,
      adminEmail: result.adminUser.email,
      message:
        "Organization created successfully! An email has been sent to the administrator with instructions to set up their password.",
    };
  }

  @UseGuards(AuthenticatedUserGuard, OrgAdminGuard)
  @Mutation(() => CreateInviteCodeResponseType)
  async createInviteCode(
    @User() identity: Identity,
    @Args("input", { nullable: true }) input?: CreateInviteCodeInputType
  ): Promise<CreateInviteCodeResponseType> {
    if (!identity.organizationId) {
      throw new Error("Organization ID is required");
    }

    const result = await this.inviteCodeService.createInviteCode(
      identity.organizationId,
      identity.id,
      {
        maxUses: input?.maxUses,
        expiresInHours: input?.expiresInHours,
      }
    );

    return {
      success: true,
      message: "Invite code created successfully",
      code: result.code,
      inviteUrl: result.inviteUrl,
      expiresAt: result.expiresAt,
    };
  }

  @Query(() => InviteCodeValidationResponseType)
  async validateInviteCode(
    @Args("code") code: string
  ): Promise<InviteCodeValidationResponseType> {
    return this.inviteCodeService.validateInviteCode(code);
  }

  @UseGuards(AuthenticatedUserGuard, OrgAdminGuard)
  @Query(() => [InviteCodeType])
  async getOrganizationInvites(
    @User() identity: Identity
  ): Promise<InviteCodeType[]> {
    if (!identity.organizationId) {
      throw new Error("Organization ID is required");
    }

    return this.inviteCodeService.getOrganizationInviteCodes(
      identity.organizationId
    ) as any;
  }

  @ResolveField(() => [DepartmentType], { nullable: true })
  async departments(@Parent() organization: any): Promise<any[] | null> {
    if (!organization.id) {
      return null;
    }
    return this.departmentService.getDepartmentsByOrganization(organization.id);
  }
}
