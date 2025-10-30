import { join } from "node:path";
import { ConfigModule } from "@applifting-io/nestjs-decorated-config";
import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { UsersModule } from "./modules/users/users.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { SeedModule } from "./scripts/seed/seed.module";
import { Config } from "./shared/config/config.service";
import { GraphqlSetupModule } from "./shared/graphql/graphql-setup.module";
import { LoggerModule } from "./shared/logger/logger.module";
import { PairingAlgorithmModule } from "./pairing-algorithm/pairing-algorithm.module";
import { AuthModule } from "./shared/auth/auth.module";

const imports = [
  LoggerModule,
  ConfigModule.forRootAsync(Config, { validate: false, printOnStartup: false }),
  ServeStaticModule.forRoot({
    rootPath: join(process.cwd(), "uploads"),
    serveRoot: "/uploads", // This means files are accessible under http://host/uploads/...
  }),
  AuthModule,
  SeedModule,
  UsersModule,
  OrganizationModule,
  GraphqlSetupModule,
  PairingAlgorithmModule,
];

@Module({
  imports,
})
export class AppModule {}
