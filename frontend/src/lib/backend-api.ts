"use client";

/**
 * Lightweight helpers for calling backend API endpoints.
 * Reuses the same base-URL resolution logic as auth-api.ts.
 */

const defaultLocalApiBaseUrl = "http://localhost:8787";

function resolveApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (value && value.length > 0) return value;

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return defaultLocalApiBaseUrl;
    }
  }

  return defaultLocalApiBaseUrl;
}

function endpoint(path: string): string {
  return `${resolveApiBaseUrl()}${path}`;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export type CalendarTodayEvent = {
  id: string;
  summary: string;
  location: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
};

export type CalendarTodayResponse = {
  date: string;
  events: CalendarTodayEvent[];
  earliestEvent: CalendarTodayEvent | null;
};

export async function fetchCalendarToday(): Promise<CalendarTodayResponse> {
  const res = await fetch(endpoint("/calendar/today"), {
    credentials: "include",
  });
  if (!res.ok)
    throw new Error(`Calendar API: ${res.status} ${await res.text()}`);
  return (await res.json()) as CalendarTodayResponse;
}

// ---------------------------------------------------------------------------
// Transit (Routes API)
// ---------------------------------------------------------------------------

export async function fetchTransitDirections(
  origin: string,
  destination: string,
  arrivalTime?: string,
): Promise<unknown> {
  const res = await fetch(endpoint("/transit/directions"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, destination, arrivalTime }),
  });
  if (!res.ok)
    throw new Error(`Transit API: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Morning Briefing (Calendar + Transit + Weather)
// ---------------------------------------------------------------------------

export async function fetchMorningBriefing(
  currentLocation: string,
  prepMinutes?: number,
  forceRefresh?: boolean,
): Promise<unknown> {
  const res = await fetch(endpoint("/briefing/morning"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentLocation, prepMinutes, forceRefresh }),
  });
  if (!res.ok)
    throw new Error(`Briefing API: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Morning Routine (D1 persisted)
// ---------------------------------------------------------------------------

export type MorningRoutineItem = {
  id: string;
  label: string;
  minutes: number;
};

export type MorningRoutineResponse = {
  items: MorningRoutineItem[];
};

export async function fetchMorningRoutine(): Promise<MorningRoutineResponse> {
  const res = await fetch(endpoint("/briefing/routine"), {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok)
    throw new Error(`Routine API: ${res.status} ${await res.text()}`);
  return (await res.json()) as MorningRoutineResponse;
}

export async function updateMorningRoutine(
  items: MorningRoutineItem[],
): Promise<MorningRoutineResponse> {
  const res = await fetch(endpoint("/briefing/routine"), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok)
    throw new Error(`Routine API: ${res.status} ${await res.text()}`);
  return (await res.json()) as MorningRoutineResponse;
}
