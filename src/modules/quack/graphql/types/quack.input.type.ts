import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class QuackInputType {
  @Field()
  text!: string;
}
