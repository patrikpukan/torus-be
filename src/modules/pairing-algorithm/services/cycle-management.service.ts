import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../core/prisma/prisma.service";

/**
 * Service for managing pairing cycle numbering and calculations
 * Handles timezone-aware cycle boundaries
 */
@Injectable()
export class CycleManagementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the current cycle number for an organization
   * Based on the number of closed pairing periods + 1 for the active period
   *
   * This ensures consistent cycle numbering across timezones by using
   * the actual pairing period creation/closure as the source of truth
   */
  async getCurrentCycleNumber(organizationId: string): Promise<number> {
    // Count closed periods to determine cycle number
    const closedPeriodsCount = await this.prisma.pairingPeriod.count({
      where: {
        organizationId,
        status: "closed",
      },
    });

    // Check if there's an active period
    const hasActivePeriod = await this.prisma.pairingPeriod.findFirst({
      where: {
        organizationId,
        status: "active",
      },
    });

    // Cycle number is based on completed cycles (closed) + 1 if active exists
    // Cycle 1: no closed periods, active period exists
    // Cycle 2: 1 closed period, active period exists
    // etc.
    if (hasActivePeriod) {
      return closedPeriodsCount + 1;
    }

    // If no active period, we're between cycles
    // Return the next cycle number
    return closedPeriodsCount + 1;
  }

  /**
   * Get cycle number for a specific pairing period
   */
  async getCycleNumberForPeriod(periodId: string): Promise<number> {
    const period = await this.prisma.pairingPeriod.findUnique({
      where: { id: periodId },
      select: { organizationId: true },
    });

    if (!period) {
      throw new Error(`Pairing period ${periodId} not found`);
    }

    // Count all periods created before or at the same time as this period
    const periodsBeforeOrEqual = await this.prisma.pairingPeriod.count({
      where: {
        organizationId: period.organizationId,
        createdAt: { lte: new Date() }, // All periods created so far
      },
    });

    return periodsBeforeOrEqual;
  }

  /**
   * Calculate the start of a pairing cycle (beginning of period)
   * Useful for timezone-aware comparisons
   */
  getCycleStartDate(period: { startDate: Date | null }): Date {
    if (period.startDate) {
      return period.startDate;
    }
    // If no explicit start date, assume cycle starts at creation
    return new Date();
  }

  /**
   * Calculate the end of a pairing cycle (end of period)
   * Useful for timezone-aware comparisons
   */
  getCycleEndDate(period: { endDate: Date | null }): Date | null {
    if (period.endDate) {
      return period.endDate;
    }
    return null;
  }

  /**
   * Determine if a date falls within a pairing cycle
   */
  isDateInCycle(
    date: Date,
    cycleStart: Date,
    cycleEnd: Date | null
  ): boolean {
    if (date < cycleStart) {
      return false;
    }

    if (cycleEnd && date > cycleEnd) {
      return false;
    }

    return true;
  }
}
