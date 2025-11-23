import { Module } from "@nestjs/common";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { GoogleCalendarService } from "./services/google-calendar.service";
import { GoogleCalendarResolver } from "./graphql/resolvers/google-calendar.resolver";
import { CalendarModule } from "../calendar/calendar.module";
import { SupabaseAdminService } from "src/shared/auth/supabase-admin.service";

@Module({
  imports: [PrismaModule, CalendarModule],
  providers: [
    GoogleCalendarService,
    GoogleCalendarResolver,
    SupabaseAdminService,
  ],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}
