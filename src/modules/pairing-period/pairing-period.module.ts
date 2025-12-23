import { Module } from "@nestjs/common";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { PairingPeriodResolver } from "./pairing-period.resolver";
import { PairingPeriodService } from "./pairing-period.service";
import { PairingPeriodRepository } from "./pairing-period.repository";

@Module({
  imports: [PrismaModule],
  providers: [
    PairingPeriodResolver,
    PairingPeriodService,
    PairingPeriodRepository,
  ],
  exports: [PairingPeriodService],
})
export class PairingPeriodModule {}
