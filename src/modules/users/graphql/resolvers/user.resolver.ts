import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { User } from "src/shared/auth/decorators/user.decorator";
import type { Identity } from "src/shared/auth/domain/identity";
import { AuthenticatedUserGuard } from "src/shared/auth/guards/authenticated-user.guard";
import { UserService } from "../../services/user.service";
import { SignUpInputType } from "../types/sign-up-input.type";
import { UpdateUserInputType } from "../types/update-user-input.type";
import { UserType } from "../types/user.type";
import { CurrentUserType } from "../types/current-user.type";
import { UpdateCurrentUserProfileInputType } from "../types/update-current-user-profile-input.type";
import { PairingHistoryType } from "../types/pairing-history.type";

@Resolver(() => UserType)
export class UserResolver {
  constructor(private userService: UserService) {}

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => UserType, { nullable: true })
  async userById(
    @User() identity: Identity,
    @Args("id", { type: () => ID }) id: string
  ): Promise<UserType | null> {
    return this.userService.getUserById(identity, id);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [UserType])
  async users(@User() identity: Identity): Promise<UserType[]> {
    return this.userService.listUsers(identity);
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
    return this.userService.getCurrentUser(identity);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => UserType)
  async deleteUser(
    @User() identity: Identity,
    @Args("id", { type: () => ID }) id: string
  ): Promise<UserType> {
    return this.userService.deleteUserById(identity, id);
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
    return this.userService.updateCurrentUserProfile(identity, input);
  }

  @Mutation(() => UserType)
  async signUp(@Args("data") data: SignUpInputType): Promise<UserType> {
    return this.userService.signUp(
      {
        email: data.email,
        password: data.password,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
      },
      data.profilePicture
    );
  }
}
