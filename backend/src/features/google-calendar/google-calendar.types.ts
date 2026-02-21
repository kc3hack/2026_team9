/** A single Google Calendar event (simplified). */
export type CalendarEvent = {
  id: string;
  summary: string;
  location: string | null;
  /** ISO-8601 datetime or date string. */
  start: string;
  /** ISO-8601 datetime or date string. */
  end: string;
  /** true for all-day events. */
  isAllDay: boolean;
};

/** Result of fetching today's events. */
export type TodayEventsResult = {
  /** YYYY-MM-DD */
  date: string;
  events: CalendarEvent[];
  /** The earliest *timed* (non-all-day) event, or null. */
  earliestEvent: CalendarEvent | null;
};
