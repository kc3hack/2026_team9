import { getTodayEvents } from "../google-calendar/google-calendar.service";
import type { CalendarEvent } from "../google-calendar/google-calendar.types";
import { getTransitDirections } from "../transit/transit.service";
import type { TransitRoute } from "../transit/transit.types";
import { getWeather } from "../weather/weather.service";
import type { WeatherInfo } from "../weather/weather.types";
import type {
  EventBriefing,
  MorningBriefingRequest,
  MorningBriefingResult,
} from "./morning-briefing.types";

// ---------------------------------------------------------------------------
// JST helpers
// ---------------------------------------------------------------------------

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function jstNow(): Date {
  return new Date(Date.now() + JST_OFFSET_MS);
}

/** "HH:mm" in JST from a UTC Date. */
function toJstHHmm(d: Date): string {
  const jst = new Date(d.getTime() + JST_OFFSET_MS);
  const h = jst.getUTCHours().toString().padStart(2, "0");
  const m = jst.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Parse an ISO-8601 datetime → minutes-since-midnight in JST. */
function toJstMinutes(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return -1;
  const jst = new Date(d.getTime() + JST_OFFSET_MS);
  return jst.getUTCHours() * 60 + jst.getUTCMinutes();
}

/** Subtract `minutes` from a JST minutes-since-midnight value → "HH:mm". */
function subtractMinutes(jstMinOfDay: number, minutes: number): string {
  const total = (((jstMinOfDay - minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ---------------------------------------------------------------------------
// Late-risk engine
// ---------------------------------------------------------------------------

/**
 * Compute a late-risk percentage (0–100).
 *
 * Model:
 *   slackMinutes = (event start minutes) − (now minutes) − transitMinutes − prepMinutes
 *
 *   slack >= 15 min  →  0%  (comfortable)
 *   slack <= −10 min → 100% (basically late)
 *   In between       → linear 0–100 + a flat 10% transit-delay buffer
 *
 * This is intentionally simple and deterministic — no ML, no history needed,
 * yet gives useful "urgency" feedback.
 */
function computeLateRisk(slackMinutes: number): number {
  const COMFORTABLE = 15; // minutes of margin considered "safe"
  const HOPELESS = -10; // at this point you're late
  const TRANSIT_BUFFER = 10; // flat % added to account for delays

  if (slackMinutes >= COMFORTABLE) return 0;
  if (slackMinutes <= HOPELESS) return 100;

  // Linear from 0% (at COMFORTABLE) to 90% (at HOPELESS)
  const range = COMFORTABLE - HOPELESS; // 25
  const raw = ((COMFORTABLE - slackMinutes) / range) * 90;
  const withBuffer = raw + TRANSIT_BUFFER;
  return Math.min(100, Math.max(0, Math.round(withBuffer)));
}

// ---------------------------------------------------------------------------
// Briefing builder (per event)
// ---------------------------------------------------------------------------

async function buildEventBriefing(
  apiKey: string,
  currentLocation: string,
  event: CalendarEvent,
  prepMinutes: number,
  nowMinutes: number,
): Promise<EventBriefing> {
  const destination = event.location as string; // caller guarantees non-null

  // Ask Google Directions for transit route arriving by event start time
  const transit = await getTransitDirections(apiKey, {
    origin: currentLocation,
    destination,
    arrivalTime: event.start, // arrive by event start
  });

  const route: TransitRoute | null = transit.bestRoute;
  const transitMinutes = route?.durationMinutes ?? 0;

  // Event start in JST minutes-since-midnight
  const eventStartMin = toJstMinutes(event.start);

  // Recommended departure = event start − transit duration
  const leaveByMin = eventStartMin - transitMinutes;
  const leaveBy = subtractMinutes(eventStartMin, transitMinutes);

  // Recommended wake-up = departure − prep time
  const wakeUpBy = subtractMinutes(eventStartMin, transitMinutes + prepMinutes);

  // Slack = how many minutes you have until you MUST leave
  const slackMinutes = leaveByMin - nowMinutes;

  const lateRiskPercent = computeLateRisk(slackMinutes);

  return {
    event,
    destination,
    route,
    transitMinutes,
    leaveBy,
    wakeUpBy,
    slackMinutes,
    lateRiskPercent,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate a complete morning briefing for the authenticated user.
 *
 * Flow:
 *   1. Fetch today's Google Calendar events
 *   2. For each event **with a location**, query Google Directions (transit)
 *   3. Compute departure time, wake-up time, slack, late-risk
 *   4. Return a sorted list + the most urgent item
 */
export async function getMorningBriefing(
  env: Env,
  userId: string,
  req: MorningBriefingRequest,
): Promise<MorningBriefingResult> {
  const now = jstNow();
  const nowHHmm = toJstHHmm(new Date()); // based on real UTC
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const dateStr = now.toISOString().split("T")[0] as string;

  const prepMinutes = req.prepMinutes ?? 30;

  // 1️⃣ Calendar
  const calendar = await getTodayEvents(env, userId);

  // Separate events with / without location
  const withLocation = calendar.events.filter(
    (e) => !e.isAllDay && e.location && e.location.trim().length > 0,
  );
  const withoutLocation = calendar.events.filter(
    (e) => e.isAllDay || !e.location || e.location.trim().length === 0,
  );

  // 2️⃣ Transit + risk for each event with a location (in parallel)
  const apiKey = env.GOOGLE_MAPS_API_KEY;
  const briefings: EventBriefing[] = apiKey
    ? await Promise.all(
        withLocation.map((event) =>
          buildEventBriefing(
            apiKey,
            req.currentLocation,
            event,
            prepMinutes,
            nowMinutes,
          ),
        ),
      )
    : withLocation.map((event) => ({
        event,
        destination: event.location as string,
        route: null,
        transitMinutes: 0,
        leaveBy: "--:--",
        wakeUpBy: "--:--",
        slackMinutes: 0,
        lateRiskPercent: 0,
      }));

  // Sort by event start time (earliest first)
  briefings.sort((a, b) => {
    const aMin = toJstMinutes(a.event.start);
    const bMin = toJstMinutes(b.event.start);
    return aMin - bMin;
  });

  // The first (earliest) briefing is the most urgent
  const urgent = briefings.length > 0 ? (briefings[0] ?? null) : null;

  // 3️⃣ Weather — check at the departure location around the leave-by time
  let weather: WeatherInfo | null = null;
  try {
    const weatherLocation = urgent?.destination ?? req.currentLocation;
    const weatherTime = urgent?.leaveBy ?? nowHHmm;
    weather = await getWeather(weatherLocation, weatherTime, env);
  } catch {
    // Never let weather break the briefing
    weather = null;
  }

  return {
    date: dateStr,
    now: nowHHmm,
    totalEvents: calendar.events.length,
    briefings,
    urgent,
    eventsWithoutLocation: withoutLocation,
    weather,
  };
}
