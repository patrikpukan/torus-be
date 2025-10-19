import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User } from 'src/shared/auth/decorators/user.decorator';
import { Identity } from 'src/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from 'src/shared/auth/guards/authenticated-user.guard';
import { UserService } from '../../services/user.service';
import { SignUpInputType } from '../types/sign-up-input.type';
import { UpdateUserInputType } from '../types/update-user-input.type';
import { UserType } from '../types/user.type';

@Resolver(() => UserType)
export class UserResolver {
  constructor(private userService: UserService) {}

  @Query(() => UserType, { nullable: true })
  async user(
    @Args('username', { type: () => String }) username: string,
  ): Promise<UserType | null> {
    return this.userService.getUserByUsername(username);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => UserType)
  async deleteUser(
    @User() identity: Identity,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<UserType> {
    return this.userService.deleteUserById(identity, id);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => UserType)
  async updateUser(
    @User() identity: Identity,
    @Args('data') data: UpdateUserInputType,
  ): Promise<UserType | null> {
    return this.userService.updateUserById(identity, data.id, data);
  }

  @Mutation(() => UserType)
  async signUp(@Args('data') data: SignUpInputType): Promise<UserType> {
    return this.userService.signUp(
      {
        email: data.email,
        password: data.password,
        name: data.name,
        username: data.username,
      },
      data.profilePicture,
    );
  }
}
