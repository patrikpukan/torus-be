import { Field, ObjectType } from '@nestjs/graphql';
import { QuackCreatedEvent } from '../../interfaces/quack-created-event.interface';

@ObjectType({
  description:
    'Event emitted when a new quack is created. Subscribe via the `quackCreated` subscription field',
})
export class QuackCreatedEventType implements QuackCreatedEvent {
  @Field({
    description: 'The id of the newly created quack',
    nullable: false,
  })
  quackId!: string;
}
