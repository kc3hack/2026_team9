import { createAuth } from "../../lib/auth";
import type { CalendarEvent, TodayEventsResult } from "./google-calendar.types";

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

const GOOGLE_PROVIDER_ID = "google";

/**
 * Retrieve a valid Google access token for the given user.
 *
 * Better Auth handles token decryption / refresh internally. We should always
 * use the public `getAccessToken` API instead of reading `account` rows
 * directly.
 */
async function getGoogleAccessToken(
  env: Env,
  userId: string,
): Promise<string | null> {
  const auth = createAuth(env);
  try {
    const tokenPayload = await auth.api.getAccessToken({
      body: {
        providerId: GOOGLE_PROVIDER_ID,
        userId,
      },
    });

    if (
      !tokenPayload ||
      typeof tokenPayload.accessToken !== "string" ||
      tokenPayload.accessToken.trim().length === 0
    ) {
      return null;
    }

    return tokenPayload.accessToken;
  } catch (error) {
    console.error("Failed to get Google access token:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Calendar API
// ---------------------------------------------------------------------------

/**
 * Fetch today's events from the authenticated user's primary Google Calendar.
 *
 * Time zone is fixed to `Asia/Tokyo` (JST).
 */
export async function getTodayEvents(
  env: Env,
  userId: string,
): Promise<TodayEventsResult> {
  // Compute "today" in JST
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const date = jstNow.toISOString().split("T")[0] as string;

  const accessToken = await getGoogleAccessToken(env, userId);
  if (!accessToken) {
    return { date, events: [], earliestEvent: null };
  }

  const timeMin = new Date(`${date}T00:00:00+09:00`).toISOString();
  const timeMax = new Date(`${date}T23:59:59+09:00`).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    timeZone: "Asia/Tokyo",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    console.error("Google Calendar API error:", res.status, await res.text());
    return { date, events: [], earliestEvent: null };
  }

  // biome-ignore lint/suspicious/noExplicitAny: Google Calendar API response
  const data = (await res.json()) as any;

  const events: CalendarEvent[] = (data.items ?? [])
    // biome-ignore lint/suspicious/noExplicitAny: Google Calendar event
    .filter((item: any) => item.status !== "cancelled")
    // biome-ignore lint/suspicious/noExplicitAny: Google Calendar event
    .map((item: any) => ({
      id: item.id as string,
      summary: (item.summary as string) ?? "(無題)",
      location: (item.location as string) ?? null,
      start: item.start?.dateTime ?? item.start?.date ?? "",
      end: item.end?.dateTime ?? item.end?.date ?? "",
      isAllDay: !item.start?.dateTime,
    }));

  const timedEvents = events.filter((e) => !e.isAllDay);
  const earliestEvent =
    timedEvents.length > 0 ? (timedEvents[0] ?? null) : null;

  return { date, events, earliestEvent };
}
