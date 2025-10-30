import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { OrganizationService } from "../../services/organization.service";
import { RegisterOrganizationInputType } from "../types/register-organization-input.type";
import { RegisterOrganizationResponseType } from "../types/register-organization-response.type";
import { Logger, UseGuards } from "@nestjs/common";
import { OrganizationType } from "../types/organization.type";
import { User } from "src/shared/auth/decorators/user.decorator";
import type { Identity } from "src/shared/auth/domain/identity";
import { AuthenticatedUserGuard } from "src/shared/auth/guards/authenticated-user.guard";
import { UpdateOrganizationInputType } from "../types/update-organization-input.type";
import { InviteUserInputType } from "../types/invite-user-input.type";
import { InviteUserResponseType } from "../types/invite-user-response.type";

@Resolver()
export class OrganizationResolver {
  private readonly logger = new Logger(OrganizationResolver.name);

  constructor(private readonly organizationService: OrganizationService) {}

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [OrganizationType])
  async organizations(): Promise<OrganizationType[]> {
    return this.organizationService.listOrganizations();
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => OrganizationType, { nullable: true })
  async organizationById(
    @Args("id", { type: () => ID }) id: string
  ): Promise<OrganizationType | null> {
    return this.organizationService.getOrganizationById(id);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => OrganizationType, { nullable: true })
  async myOrganization(
    @User() identity: Identity
  ): Promise<OrganizationType | null> {
    return this.organizationService.getOrganizationByUserId(identity.id);
  }

  @UseGuards(AuthenticatedUserGuard)
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

  @UseGuards(AuthenticatedUserGuard)
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
}
