import { MessageEvent } from '@nestjs/common';
import { from, map, Observable } from 'rxjs';
import { PubSub } from '../interfaces/pub-sub.interface';

export type Topic = string;

export abstract class BasePubSubService implements PubSub {
  abstract publish<Payload>(
    triggerName: Topic,
    payload: Payload,
  ): Promise<void>;

  abstract asyncIterator<Payload>(
    triggers: Topic | Topic[],
  ): AsyncIterator<Payload>;

  subscribe<Payload>(triggers: Topic | Topic[]): Observable<Payload> {
    const asyncIterator = this.asyncIterator(triggers);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return from(asyncIterator as any).pipe(map((event) => event as Payload));
  }

  subscribeSse<Payload>(
    triggers: Topic | Topic[],
  ): Observable<MessageEvent | { data: Payload }> {
    return this.subscribe(triggers).pipe(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map((event) => ({ data: event as any as Payload }) as MessageEvent),
    );
  }
}
