import { Module } from "@nestjs/common";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { CalendarEventRepository } from "./repositories/calendar-event.repository";
import { MeetingEventRepository } from "./repositories/meeting-event.repository";
import { CalendarEventService } from "./services/calendar-event.service";
import { MeetingEventService } from "./services/meeting-event.service";
import { CalendarEventResolver } from "./graphql/resolvers/calendar-event.resolver";
import { MeetingEventResolver } from "./graphql/resolvers/meeting-event.resolver";

@Module({
  imports: [PrismaModule],
  providers: [
    CalendarEventRepository,
    MeetingEventRepository,
    CalendarEventService,
    MeetingEventService,
    CalendarEventResolver,
    MeetingEventResolver,
  ],
  exports: [CalendarEventService, MeetingEventService],
})
export class CalendarModule {}
