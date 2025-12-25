import { Field, ID, InputType } from "@nestjs/graphql";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

@InputType()
export class CreateDepartmentInput {
  @Field()
  @IsNotEmpty({ message: "Department name is required" })
  @IsString({ message: "Department name must be a string" })
  @MinLength(2, { message: "Name must be at least 2 characters" })
  @MaxLength(100, { message: "Name must not exceed 100 characters" })
  name!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  @MaxLength(500, { message: "Description must not exceed 500 characters" })
  description?: string;

  @Field(() => ID)
  @IsNotEmpty({ message: "Organization ID is required" })
  @IsUUID("4", { message: "Organization ID must be a valid UUID" })
  organizationId!: string;
}

@InputType()
export class UpdateDepartmentInput {
  @Field(() => ID)
  @IsNotEmpty({ message: "Department ID is required" })
  @IsUUID("4", { message: "Department ID must be a valid UUID" })
  id!: string;

  @Field()
  @IsNotEmpty({ message: "Department name is required" })
  @IsString({ message: "Department name must be a string" })
  @MinLength(2, { message: "Name must be at least 2 characters" })
  @MaxLength(100, { message: "Name must not exceed 100 characters" })
  name!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  @MaxLength(500, { message: "Description must not exceed 500 characters" })
  description?: string;
}

@InputType()
export class DeleteDepartmentInput {
  @Field(() => ID)
  @IsNotEmpty({ message: "Department ID is required" })
  @IsUUID("4", { message: "Department ID must be a valid UUID" })
  id!: string;

  @Field(() => ID)
  @IsNotEmpty({ message: "Organization ID is required" })
  @IsUUID("4", { message: "Organization ID must be a valid UUID" })
  organizationId!: string;
}
