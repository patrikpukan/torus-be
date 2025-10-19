import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { PubSubService } from 'src/core/pub-sub/services/pub-sub.service';
import { User } from 'src/shared/auth/decorators/user.decorator';
import { Identity } from 'src/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from 'src/shared/auth/guards/authenticated-user.guard';
import { QuacksService } from '../../services/quacks.service';
import { QuackCreatedEventType } from '../types/quack-created-event.type';
import { QuackType } from '../types/quack.type';

@Resolver(() => QuackType)
export class QuackResolver {
  constructor(
    private readonly quacksService: QuacksService,
    private readonly pubSubService: PubSubService,
  ) {}

  @Query(() => [QuackType])
  async quacks(): Promise<QuackType[]> {
    return this.quacksService.getQuacks();
  }

  @Mutation(() => QuackType)
  @UseGuards(AuthenticatedUserGuard)
  async addQuack(
    @User() user: Identity,
    @Args('text') text: string,
  ): Promise<QuackType> {
    return this.quacksService.createQuack(user, { text });
  }

  @Mutation(() => String)
  @UseGuards(AuthenticatedUserGuard)
  async deleteQuack(
    @User() user: Identity,
    @Args('quackId') quackId: number,
  ): Promise<string> {
    await this.quacksService.deleteQuack(user, quackId.toString());
    return 'Quack deleted successfully';
  }

  @Subscription(() => QuackCreatedEventType)
  quackCreated(): AsyncIterator<QuackCreatedEventType> {
    return this.pubSubService.asyncIterator<QuackCreatedEventType>(
      'quackCreated',
    );
  }
}
