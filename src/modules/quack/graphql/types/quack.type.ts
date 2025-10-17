import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Quack')
export class QuackType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  text!: string;

  @Field()
  createdAt!: Date;

  @Field()
  userId!: string;
}
