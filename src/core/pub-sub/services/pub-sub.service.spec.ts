import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { PubSubSymbol } from '../utils/pubsub.symbol';
import { PubSubService } from './pub-sub.service';

describe('PubSubService', () => {
  let service: PubSubService;
  let mockPubSub: any;

  beforeEach(async () => {
    mockPubSub = {
      publish: jest.fn(() => Promise.resolve()),
      asyncIterator: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        PubSubService,
        {
          provide: PubSubSymbol,
          useValue: mockPubSub,
        },
      ],
    }).compile();

    service = module.get<PubSubService>(PubSubService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should call publish method of AMQPPubSub with correct parameters', async () => {
      const topic = 'testTopic';
      const payload = 'testPayload';

      await service.publish(topic, payload);

      expect(mockPubSub.publish).toHaveBeenCalledWith(topic, payload);
    });
  });

  describe('asyncIterator', () => {
    it('should call asyncIterator method of AMQPPubSub with correct parameters', () => {
      const topic = 'testTopic';

      service.asyncIterator(topic);

      expect(mockPubSub.asyncIterator).toHaveBeenCalledWith(topic);
    });
  });
});
