import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PubSubService } from 'src/core/pub-sub/services/pub-sub.service';
import { Identity } from 'src/shared/auth/domain/identity';
import { AbilityFactory } from 'src/shared/permissions/factory/ability.factory';
import { Quack } from '../domain/quack';
import { QuackCreatedEvent } from '../interfaces/quack-created-event.interface';
import { QuackRepository } from '../repositories/quack.repository';

@Injectable()
export class QuacksService {
  constructor(
    private readonly quackRepository: QuackRepository,
    private readonly abilityFactory: AbilityFactory,
    private readonly pubSubService: PubSubService,
  ) {}

  async getQuacks(): Promise<Quack[]> {
    return this.quackRepository.getQuacks();
  }

  async getQuacksByUserId(userId: string): Promise<Quack[]> {
    return this.quackRepository.getQuacksByUserId(userId);
  }

  async createQuack(
    user: Identity,
    quackData: { text: string },
  ): Promise<Quack> {
    const quack = await this.quackRepository.createQuack({
      text: quackData.text,
      userId: user.id,
    });

    // this is useful for having real-time updates on front end for example
    void this.pubSubService.publish<{ quackCreated: QuackCreatedEvent }>(
      'quackCreated',
      {
        quackCreated: { quackId: quack.id },
      },
    );

    return quack;
  }

  async deleteQuack(user: Identity, id: string): Promise<Quack | null> {
    const quack = await this.quackRepository.getById(id);

    if (!quack) {
      throw new NotFoundException();
    }

    const ability = this.abilityFactory.createForUser(user);

    if (!ability.canDeleteQuack(quack)) {
      throw new ForbiddenException();
    }

    return await this.quackRepository.delete(id);
  }
}
