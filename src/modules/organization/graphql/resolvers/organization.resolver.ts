import { Args, Mutation, Resolver } from "@nestjs/graphql";
import { OrganizationService } from "../../services/organization.service";
import { RegisterOrganizationInputType } from "../types/register-organization-input.type";
import { RegisterOrganizationResponseType } from "../types/register-organization-response.type";
import { Logger } from "@nestjs/common";

@Resolver()
export class OrganizationResolver {
  private readonly logger = new Logger(OrganizationResolver.name);

  constructor(private readonly organizationService: OrganizationService) {}

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
