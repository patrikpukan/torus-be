import { Module } from "@nestjs/common";
import { ConfigModule } from "@applifting-io/nestjs-decorated-config";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { UserResolver } from "./graphql/resolvers/user.resolver";
import { TagResolver } from "./resolvers/tag.resolver";
import { UserRepository } from "./repositories/user.repository";
import { UserService } from "./services/user.service";
import { TagService } from "./services/tag.service";
import { IdealColleagueService } from "./services/ideal-colleague.service";
import { AuthenticatedUserGuard } from "../../shared/auth/guards/authenticated-user.guard";
import { SupabaseAdminService } from "../../shared/auth/supabase-admin.service";
import { OrganizationModule } from "../organization/organization.module";
import { UserBanRepository } from "./repositories/user-ban.repository";
import { AuthModule } from "../../shared/auth/auth.module";
import { EmailService } from "../../shared/email/email.service";
import { ReportRepository } from "./repositories/report.repository";
import { ReportResolver } from "./graphql/resolvers/report.resolver";
import { CalendarModule } from "../calendar/calendar.module";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    OrganizationModule,
    CalendarModule,
  ],
  providers: [
    UserRepository,
    UserBanRepository,
    ReportRepository,
    UserService,
    IdealColleagueService,
    TagService,
    UserResolver,
    TagResolver,
    ReportResolver,
    AuthenticatedUserGuard,
    SupabaseAdminService,
    EmailService,
  ],
})
export class UsersModule {}
