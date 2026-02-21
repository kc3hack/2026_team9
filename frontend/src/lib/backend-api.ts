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

export async function fetchCalendarToday(): Promise<unknown> {
  const res = await fetch(endpoint("/calendar/today"), {
    credentials: "include",
  });
  if (!res.ok)
    throw new Error(`Calendar API: ${res.status} ${await res.text()}`);
  return res.json();
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
): Promise<unknown> {
  const res = await fetch(endpoint("/briefing/morning"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentLocation, prepMinutes }),
  });
  if (!res.ok)
    throw new Error(`Briefing API: ${res.status} ${await res.text()}`);
  return res.json();
}
