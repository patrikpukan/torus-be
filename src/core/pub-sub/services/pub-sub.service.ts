import { Injectable, Logger } from '@nestjs/common';
import { PubSubEngine } from 'graphql-subscriptions';
import { BasePubSubService, Topic } from '../base/pub-sub.base';
import { InjectPubSubEngine } from '../utils/inject-pubsub.decorator';

@Injectable()
export class PubSubService extends BasePubSubService {
  constructor(@InjectPubSubEngine() private readonly _pubSub: PubSubEngine) {
    super();
  }

  private readonly logger = new Logger(PubSubService.name);

  publish<Value>(triggerName: Topic, payload: Value): Promise<void> {
    this.logger.log('Publishing message in topic', triggerName, payload);
    return this._pubSub.publish(triggerName, payload);
  }

  asyncIterator<Value>(triggers: Topic | Topic[]): AsyncIterator<Value> {
    this.logger.log('Subscribing to topic', triggers);
    return this._pubSub.asyncIterator<Value>(triggers);
  }
}
