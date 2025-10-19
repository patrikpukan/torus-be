import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PubSub } from 'graphql-subscriptions';
import { Observable } from 'rxjs';
import { BasePubSubService, Topic } from './pub-sub.base';

class TestPubSubService extends BasePubSubService {
  private pubSub = new PubSub();

  async publish<Payload>(triggerName: Topic, payload: Payload): Promise<void> {
    await this.pubSub.publish(triggerName, payload);
  }

  asyncIterator<Payload>(triggers: Topic | Topic[]): AsyncIterator<Payload> {
    return this.pubSub.asyncIterator<Payload>(triggers);
  }
}

describe('BasePubSubService', () => {
  let service: TestPubSubService;
  let testTopic: Topic;
  let testPayload: string;

  beforeEach(() => {
    service = new TestPubSubService();
    testTopic = 'testTopic';
    testPayload = 'testPayload';
  });

  describe('subscribe', () => {
    it('should return an Observable', () => {
      const result = service.subscribe(testTopic);
      expect(result).toBeInstanceOf(Observable);
    });
  });

  describe('subscribeSse', () => {
    it('should return an Observable', () => {
      const result = service.subscribeSse(testTopic);
      expect(result).toBeInstanceOf(Observable);
    });
  });

  describe('payload reception', () => {
    it('should receive payload from subscribe in the expected shape', (done) => {
      service.subscribe(testTopic).subscribe({
        next: (payload) => {
          expect(payload).toBe(testPayload);
          done();
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      service.publish(testTopic, testPayload);
    });

    it('should receive payload from subscribeSse in the expected shape', (done) => {
      service.subscribeSse(testTopic).subscribe({
        next: (event) => {
          expect(event.data).toBe(testPayload);
          done();
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      service.publish(testTopic, testPayload);
    });
  });
});
