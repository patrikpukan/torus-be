import { Module } from "@nestjs/common";
import { ConfigModule } from "@applifting-io/nestjs-decorated-config";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { AuthModule } from "../../shared/auth/auth.module";
import { StatisticsResolver } from "./graphql/resolvers/statistics.resolver";
import { StatisticsService } from "./services/statistics.service";
import { StatisticsRepository } from "./repositories/statistics.repository";

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  providers: [StatisticsRepository, StatisticsService, StatisticsResolver],
  exports: [StatisticsService],
})
export class StatisticsModule {}

