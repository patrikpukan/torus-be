import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { QuackType } from 'src/modules/quack/graphql/types/quack.type';
import { UserService } from '../../services/user.service';
import { UserType } from '../types/user.type';

@Resolver(() => QuackType)
export class QuackUserResolver {
  constructor(private readonly userService: UserService) {}

  @ResolveField(() => UserType)
  async user(@Parent() parent: QuackType): Promise<UserType | null> {
    return this.userService.getUserById(parent.userId);
  }
}
