import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { google } from "googleapis";
import { Identity } from "src/shared/auth/domain/identity";
import { SupabaseAdminService } from "src/shared/auth/supabase-admin.service";
import { CalendarEventService } from "src/modules/calendar/services/calendar-event.service";
import { PrismaService } from "src/core/prisma/prisma.service";
import { withRls } from "src/db/withRls";
import { getRlsClaims } from "src/shared/auth/utils/get-rls-claims";
import { CalendarEventType } from "@prisma/client";

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
}

export interface ImportEventsInput {
  calendarIds: string[];
  startDate: Date;
  endDate: Date;
  accessToken?: string;
}

export interface ImportEventsResult {
  success: boolean;
  importedCount: number;
  message: string;
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly calendarEventService: CalendarEventService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Get the user's Google access token from Supabase
   */
  private async getGoogleAccessToken(identity: Identity): Promise<string> {
    if (!this.supabaseAdmin.isEnabled()) {
      throw new BadRequestException("Supabase admin client is not configured");
    }

    try {
      // Get user from Supabase to retrieve provider tokens
      if (!this.supabaseAdmin["client"]) {
        throw new BadRequestException("Supabase client not initialized");
      }

      const { data: supabaseUser, error } = await this.supabaseAdmin[
        "client"
      ].auth.admin.getUserById(identity.id);

      if (error || !supabaseUser) {
        this.logger.error(
          `Failed to get Supabase user: ${error?.message || "User not found"}`
        );
        throw new BadRequestException(
          "Failed to retrieve Google authentication"
        );
      }

      // Get Google provider token
      const googleIdentity = supabaseUser.user.identities?.find(
        (id) => id.provider === "google"
      );

      if (!googleIdentity) {
        throw new BadRequestException(
          "No Google account linked. Please sign in with Google."
        );
      }

      // Check if we have a valid access token
      // Note: Supabase stores provider tokens in user metadata
      // We need to check the user's app_metadata or user_metadata
      const providerToken =
        (supabaseUser.user as any).app_metadata?.provider_token ||
        (supabaseUser.user as any).user_metadata?.provider_token;

      if (!providerToken) {
        throw new BadRequestException(
          "Google Calendar access not granted. Please sign out and sign in again to grant calendar permissions."
        );
      }

      return providerToken;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error("Error retrieving Google access token", error);
      throw new BadRequestException(
        "Failed to retrieve Google Calendar access"
      );
    }
  }

  /**
   * Fetch the list of calendars from the user's Google account
   */
  async getCalendarList(
    identity: Identity,
    accessToken?: string
  ): Promise<GoogleCalendarListItem[]> {
    const token = accessToken || (await this.getGoogleAccessToken(identity));

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    try {
      const response = await calendar.calendarList.list({});

      const calendars: GoogleCalendarListItem[] = (response.data.items || [])
        .filter((item) => item.id)
        .map((item) => ({
          id: item.id!,
          summary: item.summary || item.id!,
          backgroundColor: item.backgroundColor ?? undefined,
          foregroundColor: item.foregroundColor ?? undefined,
          primary: item.primary ?? undefined,
        }));

      return calendars;
    } catch (error: any) {
      this.logger.error("Error fetching Google Calendar list", error);

      if (error.code === 401 || error.code === 403) {
        throw new BadRequestException(
          "Calendar access denied. Please sign out and sign in again to grant calendar permissions."
        );
      }

      throw new BadRequestException(
        `Failed to fetch Google Calendar list: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Import events from specified Google calendars
   */
  async importEvents(
    identity: Identity,
    input: ImportEventsInput
  ): Promise<ImportEventsResult> {
    const token =
      input.accessToken || (await this.getGoogleAccessToken(identity));

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    try {
      // Step 1: Delete all existing Google Calendar events for this user
      await withRls(this.prisma, getRlsClaims(identity), async (tx) => {
        await tx.calendarEvent.deleteMany({
          where: {
            userId: identity.id,
            externalSource: "google" as any, // Type will be correct after prisma generate
          },
        });
      });

      this.logger.log(
        `Deleted existing Google Calendar events for user ${identity.id}`
      );

      let totalImported = 0;
      const importedExternalIds = new Set<string>(); // Track imported event IDs to avoid duplicates

      // Step 2: Fetch events from each selected calendar
      for (const calendarId of input.calendarIds) {
        try {
          const response = await calendar.events.list({
            calendarId,
            timeMin: input.startDate.toISOString(),
            timeMax: input.endDate.toISOString(),
            singleEvents: true, // Expand recurring events into individual occurrences
            orderBy: "startTime",
            maxResults: 2500, // Google's max per request
          });

          const events = response.data.items || [];
          this.logger.log(
            `Fetched ${events.length} events from calendar ${calendarId}`
          );

          // Step 3: Transform and create calendar events
          for (const googleEvent of events) {
            if (!googleEvent.id) continue;

            // Skip if we've already imported this event (can happen with shared calendars)
            if (importedExternalIds.has(googleEvent.id)) {
              continue;
            }

            // Skip events without start/end times (shouldn't happen with singleEvents=true)
            if (!googleEvent.start || !googleEvent.end) continue;

            // Handle all-day events
            let startDateTime: Date;
            let endDateTime: Date;

            if (googleEvent.start.date) {
              // All-day event
              // Google Calendar's end date for all-day events is exclusive
              // e.g., Nov 17-18 means only Nov 17
              // Store as local midnight to avoid timezone shifts
              startDateTime = new Date(googleEvent.start.date + "T00:00:00");
              // Subtract one day from the end date and set to 23:59:59
              const exclusiveEndDate = new Date(googleEvent.end!.date!);
              exclusiveEndDate.setDate(exclusiveEndDate.getDate() - 1);
              endDateTime = new Date(
                exclusiveEndDate.toISOString().split("T")[0] + "T23:59:59"
              );
            } else if (googleEvent.start.dateTime) {
              // Timed event
              startDateTime = new Date(googleEvent.start.dateTime);
              endDateTime = new Date(googleEvent.end!.dateTime!);
            } else {
              continue; // Skip if we can't determine times
            }

            // Create calendar event in our database
            await withRls(this.prisma, getRlsClaims(identity), async (tx) => {
              await tx.calendarEvent.create({
                data: {
                  userId: identity.id,
                  type: CalendarEventType.unavailability,
                  title: googleEvent.summary || "Busy",
                  description: googleEvent.description || null,
                  startDateTime,
                  endDateTime,
                  externalId: googleEvent.id,
                  externalSource: "google",
                } as any, // Type will be correct after prisma generate
              });
            });

            // Mark this event as imported
            importedExternalIds.add(googleEvent.id);
            totalImported++;
          }
        } catch (calendarError: any) {
          this.logger.warn(
            `Failed to import events from calendar ${calendarId}: ${calendarError.message}`
          );
          // Continue with other calendars
        }
      }

      return {
        success: true,
        importedCount: totalImported,
        message: `Successfully imported ${totalImported} events from Google Calendar`,
      };
    } catch (error: any) {
      this.logger.error("Error importing Google Calendar events", error);

      if (error.code === 401 || error.code === 403) {
        throw new BadRequestException(
          "Calendar access denied. Please sign out and sign in again to grant calendar permissions."
        );
      }

      throw new BadRequestException(
        `Failed to import Google Calendar events: ${error.message || "Unknown error"}`
      );
    }
  }
}
