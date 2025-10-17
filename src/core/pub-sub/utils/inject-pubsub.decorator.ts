import { Inject } from '@nestjs/common';
import { PubSubSymbol } from './pubsub.symbol';

export const InjectPubSubEngine = (): ParameterDecorator =>
  Inject(PubSubSymbol);
