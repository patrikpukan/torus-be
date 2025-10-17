import { Field, ID, InputType } from '@nestjs/graphql';
import { UserRoleEnum } from '../../domain/user';

@InputType()
export class UpdateUserInputType {
  @Field(() => ID)
  id!: string;

  @Field(() => UserRoleEnum, { nullable: true })
  role?: UserRoleEnum;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  email?: string;
}
