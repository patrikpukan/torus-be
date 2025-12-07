export enum CalendarEventType {
  availability = "availability",
  unavailability = "unavailability",
}

export type CalendarEvent = {
  id: string;
  userId: string;
  type: string; // CalendarEventType value
  title?: string | null;
  description?: string | null;
  startDateTime: Date;
  endDateTime: Date;
  rrule?: string | null; // RFC 5545 format
  rruleRecurringId?: string | null; // Groups recurring series together
  exceptionDates?: string | null; // JSON array of ISO strings for exceptions
  exceptionRrules?: string | null; // JSON array of modified RRULEs
  externalId?: string | null; // Google Calendar event ID or other external source ID
  externalSource?: string | null; // Source of external event (e.g., "google")
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateCalendarEventInput = {
  userId: string;
  type: CalendarEventType | string;
  title?: string | null;
  description?: string | null;
  startDateTime: Date;
  endDateTime: Date;
  rrule?: string | null; // RFC 5545 format, null = one-time event
};

export type UpdateCalendarEventInput = {
  id: string;
  title?: string;
  description?: string;
  type?: CalendarEventType | string;
  // Time updates only for recurring series (all occurrences)
  startDateTime?: Date;
  endDateTime?: Date;
  // For updating a single occurrence, we create an exception
  // This is handled at service layer
};

export type DeleteCalendarEventInput = {
  id: string;
  // Scope: "this" | "following" | "all"
  // "this" - soft delete this occurrence (add to exceptionDates)
  // "following" - modify UNTIL in RRULE to exclude following occurrences
  // "all" - soft delete entire series (set deletedAt)
};
