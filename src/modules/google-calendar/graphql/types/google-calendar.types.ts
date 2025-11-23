import { ObjectType, Field, InputType } from "@nestjs/graphql";

@ObjectType()
export class GoogleCalendar {
  @Field()
  id: string;

  @Field()
  summary: string;

  @Field({ nullable: true })
  backgroundColor?: string;

  @Field({ nullable: true })
  foregroundColor?: string;

  @Field({ nullable: true })
  primary?: boolean;
}

@InputType()
export class ImportGoogleCalendarEventsInput {
  @Field(() => [String])
  calendarIds: string[];

  @Field()
  startDate: Date;

  @Field()
  endDate: Date;

  @Field({ nullable: true })
  accessToken?: string;
}

@ObjectType()
export class GoogleCalendarImportResult {
  @Field()
  success: boolean;

  @Field()
  importedCount: number;

  @Field()
  message: string;
}
