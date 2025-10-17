import { Field, InputType } from '@nestjs/graphql';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';

// Define an interface instead of importing it
interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => NodeJS.ReadableStream;
}

@InputType()
export class SignUpInputType {
  @Field()
  email!: string;

  @Field()
  password!: string;

  @Field()
  name!: string;

  @Field()
  username!: string;

  @Field(() => GraphQLUpload, { nullable: true })
  profilePicture?: Promise<FileUpload>;
}
