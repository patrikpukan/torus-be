import { ConfigModule } from "@applifting-io/nestjs-decorated-config";
import { Module } from "@nestjs/common";
import { PrismaService } from "../../core/prisma/prisma.service";
import { Config } from "../../shared/config/config.service";
import { SeedController } from "./seed.controller";
import { SeedService } from "./seed.service";

@Module({
  imports: [
    ConfigModule.forRootAsync(Config, {
      validate: false,
      printOnStartup: false,
    }),
  ],
  providers: [Config, PrismaService, SeedService],
  controllers: [SeedController],
})
export class SeedModule {}
