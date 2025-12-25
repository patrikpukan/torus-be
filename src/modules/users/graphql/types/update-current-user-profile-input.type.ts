import { Field, InputType } from "@nestjs/graphql";
import {
  IsOptional,
  IsUUID,
  IsString,
  MaxLength,
  IsArray,
  ArrayMaxSize,
} from "class-validator";

@InputType()
export class UpdateCurrentUserProfileInputType {
  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  about?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  hobbyIds?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  interestIds?: string[];

  @Field(() => String, { nullable: true })
  preferredActivity?: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;
}
