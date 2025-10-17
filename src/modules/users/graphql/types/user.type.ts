import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { UserRoleEnum } from '../../domain/user';

registerEnumType(UserRoleEnum, {
  name: 'UserRoleEnum',
  description: 'User role',
});

@ObjectType('User')
export class UserType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field()
  email!: string;

  @Field(() => String)
  username!: string;

  @Field(() => String, { nullable: true })
  profileImageUrl?: string | null;

  @Field(() => UserRoleEnum)
  role!: UserRoleEnum;
}
