import { createAuth } from "../../lib/auth";
import type { CalendarEvent, TodayEventsResult } from "./google-calendar.types";

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

type RefreshedToken = { access_token: string; expires_in: number };

async function refreshGoogleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<RefreshedToken | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("Google token refresh failed:", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as Record<string, unknown>;
  if (typeof data.access_token !== "string" || typeof data.expires_in !== "number") {
    return null;
  }
  return { access_token: data.access_token, expires_in: data.expires_in };
}

/**
 * Retrieve a valid Google access token for the given user.
 *
 * Better Auth stores OAuth tokens (optionally encrypted) in the `account`
 * table.  We use Better Auth's **internal adapter** so that encryption /
 * decryption is handled transparently.
 */
async function getGoogleAccessToken(
  env: Env,
  userId: string,
): Promise<string | null> {
  const auth = createAuth(env);
  // biome-ignore lint/suspicious/noExplicitAny: accessing Better Auth internals
  const ctx = await (auth as any).$context;
  if (!ctx?.internalAdapter) {
    console.error("Could not obtain Better Auth internal adapter");
    return null;
  }

  const accounts: Array<Record<string, unknown>> =
    await ctx.internalAdapter.findAccounts(userId);
  const google = accounts.find((a) => a.providerId === "google");
  if (!google) return null;

  const accessToken = typeof google.accessToken === "string" ? google.accessToken : null;
  const refreshToken = typeof google.refreshToken === "string" ? google.refreshToken : null;

  // Check whether the current access token is still valid.
  const expiresAt =
    google.accessTokenExpiresAt instanceof Date
      ? google.accessTokenExpiresAt
      : typeof google.accessTokenExpiresAt === "string"
        ? new Date(google.accessTokenExpiresAt)
        : null;

  const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : true;

  if (!isExpired && accessToken) {
    return accessToken;
  }

  // Token is expired (or missing) — try to refresh.
  if (!refreshToken) return null;

  const refreshed = await refreshGoogleAccessToken(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    refreshToken,
  );
  if (!refreshed) return null;

  // Persist the refreshed token (Better Auth encrypts transparently).
  try {
    await ctx.internalAdapter.updateAccount(
      google.id as string,
      {
        accessToken: refreshed.access_token,
        accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    );
  } catch (e) {
    console.error("Failed to persist refreshed token:", e);
    // We still got a valid token — continue.
  }

  return refreshed.access_token;
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
  const earliestEvent = timedEvents.length > 0 ? timedEvents[0]! : null;

  return { date, events, earliestEvent };
}
