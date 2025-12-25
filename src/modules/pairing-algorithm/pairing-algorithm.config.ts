import { Env } from "@applifting-io/nestjs-decorated-config";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class PairingAlgorithmConfig {
  @Env("PAIRING_CRON_ENABLED", { defaultValue: "true" })
  @IsBoolean()
  @IsOptional()
  readonly cronEnabled!: boolean;

  @Env("PAIRING_CRON_SCHEDULE", { defaultValue: "0 0 * * 1" })
  @IsString()
  @IsOptional()
  readonly cronSchedule!: string;

  @Env("PAIRING_DEFAULT_PERIOD_DAYS", { defaultValue: 21 })
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  readonly defaultPeriodDays!: number;

  @Env("PAIRING_MIN_PERIOD_DAYS", { defaultValue: 7 })
  @IsInt()
  @Min(1)
  @Max(365)
  readonly minPeriodDays!: number;

  @Env("PAIRING_MAX_PERIOD_DAYS", { defaultValue: 365 })
  @IsInt()
  @Min(1)
  @Max(365)
  readonly maxPeriodDays!: number;
}
