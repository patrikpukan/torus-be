import { ConfigModule } from '@applifting-io/nestjs-decorated-config';
import { Module } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PubSubService } from './services/pub-sub.service';
import { PubSubSymbol } from './utils/pubsub.symbol';

@Module({
  imports: [ConfigModule],
  providers: [
    PubSubService,
    {
      provide: PubSubSymbol,
      useClass: PubSub,
    },
  ],
  exports: [PubSubService],
})
export class PubSubModule {}
