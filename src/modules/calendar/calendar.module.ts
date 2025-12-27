import { Module } from "@nestjs/common";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { AuthModule } from "../../shared/auth/auth.module";
import { CalendarEventRepository } from "./repositories/calendar-event.repository";
import { MeetingEventRepository } from "./repositories/meeting-event.repository";
import { RatingRepository } from "./repositories/rating.repository";
import { CalendarEventService } from "./services/calendar-event.service";
import { MeetingEventService } from "./services/meeting-event.service";
import { RatingService } from "./services/rating.service";
import { CalendarEventResolver } from "./graphql/resolvers/calendar-event.resolver";
import { MeetingEventResolver } from "./graphql/resolvers/meeting-event.resolver";
import { RatingResolver } from "./graphql/resolvers/rating.resolver";
import { PairingAlgorithmModule } from "../pairing-algorithm/pairing-algorithm.module";
import { AchievementsModule } from "../achievements/achievements.module";

@Module({
  imports: [PrismaModule, AuthModule, PairingAlgorithmModule, AchievementsModule],
  providers: [
    CalendarEventRepository,
    MeetingEventRepository,
    RatingRepository,
    CalendarEventService,
    MeetingEventService,
    RatingService,
    CalendarEventResolver,
    MeetingEventResolver,
    RatingResolver,
  ],
  exports: [CalendarEventService, MeetingEventService, RatingService],
})
export class CalendarModule {}
