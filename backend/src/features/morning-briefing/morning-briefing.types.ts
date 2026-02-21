import type { CalendarEvent } from "../google-calendar/google-calendar.types";
import type { TransitRoute } from "../transit/transit.types";
import type { WeatherInfo } from "../weather/weather.types";

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export type MorningBriefingRequest = {
  /** User's current location (address or place name, e.g. "大阪市北区中崎西2-4-12"). */
  currentLocation: string;
  /**
   * Minutes the user needs to get ready before leaving.
   * Default: 30
   */
  prepMinutes?: number;
};

// ---------------------------------------------------------------------------
// Per-event briefing
// ---------------------------------------------------------------------------

/** Transit + timing info computed for one calendar event. */
export type EventBriefing = {
  /** The calendar event this briefing is for. */
  event: CalendarEvent;
  /** Destination extracted from the event (location field). */
  destination: string;
  /** Best transit route from currentLocation → destination. */
  route: TransitRoute | null;
  /** Transit duration in minutes. */
  transitMinutes: number;
  /** Recommended departure time (HH:mm, JST). */
  leaveBy: string;
  /** Recommended wake-up time (HH:mm, JST) — leaveBy minus prepMinutes. */
  wakeUpBy: string;
  /**
   * Minutes of slack (positive = you have spare time, negative = already late).
   * Based on current time vs leaveBy.
   */
  slackMinutes: number;
  /**
   * Estimated late risk as a percentage (0–100).
   *
   * Calculation:
   *   - 0% when slackMinutes >= 15 (comfortable margin)
   *   - 100% when slackMinutes <= -10 (almost certainly late)
   *   - Linear interpolation in between, with a 10% buffer penalty
   *     for transit (delays happen)
   */
  lateRiskPercent: number;
};

// ---------------------------------------------------------------------------
// Full response
// ---------------------------------------------------------------------------

export type MorningBriefingResult = {
  /** YYYY-MM-DD (JST) */
  date: string;
  /** Current time at the moment the briefing was computed (HH:mm, JST). */
  now: string;
  /** Total calendar events found today. */
  totalEvents: number;
  /** Events that have a location → briefing computed. */
  briefings: EventBriefing[];
  /**
   * The most urgent briefing (earliest event with location).
   * This is the one the user should act on first.
   */
  urgent: EventBriefing | null;
  /** Events that have NO location (listed for awareness). */
  eventsWithoutLocation: CalendarEvent[];
  /** Weather / umbrella info at the departure location around leave-by time. */
  weather: WeatherInfo | null;
};
