import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver, ResolveField, Parent } from "@nestjs/graphql";
import { User } from "src/shared/auth/decorators/user.decorator";
import type { Identity } from "src/shared/auth/domain/identity";
import { AuthenticatedUserGuard } from "src/shared/auth/guards/authenticated-user.guard";
import { UserService } from "../../services/user.service";
import { TagService } from "../../services/tag.service";
import { SignUpInputType } from "../types/sign-up-input.type";
import { UpdateUserInputType } from "../types/update-user-input.type";
import { UserType } from "../types/user.type";
import { CurrentUserType } from "../types/current-user.type";
import { UpdateCurrentUserProfileInputType } from "../types/update-current-user-profile-input.type";
import { PairingHistoryType } from "../types/pairing-history.type";
import { RequireRole } from "src/shared/auth/decorators/require-role.decorator";
import { UserRole } from "src/shared/auth/services/authorization.service";
import { BanUserInputType } from "../types/ban-user-input.type";
import { AnonUserType } from "../types/anon-user.type";
import { ReportUserInputType } from "../types/report-user-input.type";
import { UserReportType } from "../types/user-report.type";
import { DepartmentService } from "src/modules/organization/services/department.service";
import { TagType } from "../types/tag.type";

@Resolver(() => UserType)
export class UserResolver {
  constructor(
    private userService: UserService,
    private tagService: TagService,
    private departmentService: DepartmentService
  ) {}

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => UserType, { nullable: true })
  async userById(
    @User() identity: Identity,
    @Args("id", { type: () => ID }) id: string
  ): Promise<UserType | null> {
    return this.userService.getUserById(identity, id);
  }

  @RequireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Query(() => [UserType])
  async users(@User() identity: Identity): Promise<UserType[]> {
    return this.userService.listUsers(identity);
  }

  @RequireRole(UserRole.USER)
  @Query(() => [UserType])
  async anonUsers(@User() identity: Identity): Promise<AnonUserType[]> {
    return this.userService.listAnonUsers(identity);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [UserType])
  async getPairedUsers(@User() identity: Identity): Promise<UserType[]> {
    return this.userService.getPairedUsers(identity);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [PairingHistoryType])
  async getPairingHistory(
    @User() identity: Identity
  ): Promise<PairingHistoryType[]> {
    return this.userService.getPairingHistory(identity);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => CurrentUserType, { nullable: true })
  async getCurrentUser(
    @User() identity: Identity
  ): Promise<CurrentUserType | null> {
    const user = await this.userService.getCurrentUser(identity);
    if (!user) {
      return null;
    }
    return user as CurrentUserType;
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => UserType)
  async deleteUser(
    @User() identity: Identity,
    @Args("id", { type: () => ID }) id: string
  ): Promise<UserType> {
    return this.userService.deleteUserById(identity, id);
  }

  @RequireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Mutation(() => UserType)
  async banUser(
    @User() identity: Identity,
    @Args("input") input: BanUserInputType
  ): Promise<UserType> {
    return this.userService.banUser(identity, input);
  }

  @RequireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Mutation(() => UserType)
  async unbanUser(
    @User() identity: Identity,
    @Args("userId", { type: () => ID }) userId: string
  ): Promise<UserType> {
    return this.userService.unbanUser(identity, userId);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => UserReportType)
  async reportUser(
    @User() identity: Identity,
    @Args("input") input: ReportUserInputType
  ): Promise<UserReportType> {
    return this.userService.reportUser(identity, {
      reportedUserId: input.reportedUserId,
      reason: input.reason,
    });
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => UserType)
  async updateUser(
    @User() identity: Identity,
    @Args("data") data: UpdateUserInputType
  ): Promise<UserType | null> {
    return this.userService.updateUserById(identity, data.id, data);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => CurrentUserType)
  async updateCurrentUserProfile(
    @User() identity: Identity,
    @Args("input") input: UpdateCurrentUserProfileInputType
  ): Promise<CurrentUserType> {
    const user = await this.userService.updateCurrentUserProfile(identity, input);
    return user as CurrentUserType;
  }

  @Mutation(() => UserType)
  async signUp(@Args("data") data: SignUpInputType): Promise<UserType> {
    return this.userService.signUp(
      {
        email: data.email,
        password: data.password,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        inviteCode: data.inviteCode ?? null,
      },
      data.profilePicture
    );
  }

  @ResolveField(() => [TagType])
  async hobbies(@Parent() user: any): Promise<TagType[]> {
    if (!user.userTags) return [];

    return user.userTags
      .filter((ut: any) => ut.tag?.category === "HOBBY")
      .map((ut: any) => ut.tag);
  }

  @ResolveField(() => [TagType])
  async interests(@Parent() user: any): Promise<TagType[]> {
    if (!user.userTags) return [];

    return user.userTags
      .filter((ut: any) => ut.tag?.category === "INTEREST")
      .map((ut: any) => ut.tag);
  }

  @ResolveField()
  async department(@Parent() user: any): Promise<any | null> {
    if (!user.departmentId) {
      return null;
    }
    return this.departmentService.getDepartmentById(user.departmentId);
  }
}
