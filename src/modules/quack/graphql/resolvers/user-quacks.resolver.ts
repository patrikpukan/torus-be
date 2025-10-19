import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { QuackType } from 'src/modules/quack/graphql/types/quack.type';
import { QuacksService } from 'src/modules/quack/services/quacks.service';
import { UserType } from '../../../users/graphql/types/user.type';

/**
 * Although it might seem like it doesn't make sense to have a UserType resolver here in QuackModule, the logic behind is quite simple:
 * We only need to fetch the quacks for a specific user by userId, so we can use a quacksService from this module without needing any functionality from the User module.
 * This resolver will still add the "quacks" field to the UserType in the end.
 * This is a good approach to handle relations in GraphQL in Nest Modules.
 */
@Resolver(() => UserType)
export class UserQuacksResolver {
  constructor(private readonly quacksService: QuacksService) {}

  @ResolveField(() => [QuackType])
  async quacks(@Parent() parent: UserType): Promise<QuackType[]> {
    return this.quacksService.getQuacksByUserId(parent.id);
  }
}
