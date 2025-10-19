import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Topic } from '../base/pub-sub.base';

export interface PubSub {
  publish: <Payload>(triggerName: Topic, payload: Payload) => Promise<void>;
  asyncIterator: <Payload>(
    triggerName: Topic | Topic[],
  ) => AsyncIterator<Payload>;
  subscribe: <Payload>(triggerName: Topic | Topic[]) => Observable<Payload>;
  subscribeSse<Payload>(
    triggers: Topic | Topic[],
  ): Observable<MessageEvent | { data: Payload }>;
}
