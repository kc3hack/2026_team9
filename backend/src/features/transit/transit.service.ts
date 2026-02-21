import type {
  TransitQuery,
  TransitResult,
  TransitRoute,
} from "./transit.types";

// ---------------------------------------------------------------------------
// Google Routes API (DRIVE mode) helpers
// ---------------------------------------------------------------------------

const ROUTES_API_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

/**
 * Field mask — tells Routes API which fields to return.
 * Keep it minimal to reduce response size and billing.
 */
const FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.legs.duration",
  "routes.legs.distanceMeters",
  "routes.legs.startLocation",
  "routes.legs.endLocation",
  "routes.legs.steps.navigationInstruction",
  "routes.legs.steps.localizedValues",
  "routes.legs.steps.travelMode",
].join(",");

/** "123s" → number of seconds. */
function parseDurationSeconds(dur: unknown): number {
  if (typeof dur === "string") {
    return Number.parseInt(dur.replace("s", ""), 10) || 0;
  }
  if (typeof dur === "number") return dur;
  return 0;
}

/** JST helper: add minutes to "now" and format as "H:mm". */
function jstTimeAfterMinutes(minutes: number): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000 + minutes * 60 * 1000);
  const h = jst.getUTCHours();
  const m = jst.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** JST "now" as "H:mm". */
function jstNowHHmm(): string {
  return jstTimeAfterMinutes(0);
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

/**
 * Look up driving directions via the **Google Routes API** (DRIVE mode).
 *
 * Google does not provide transit (train/bus) routing for Japan.
 * We use DRIVE mode to estimate travel duration, then apply a multiplier
 * (×1.3 by default) to approximate public-transport time.
 *
 * Cost: covered by the $200/month free Google Maps Platform credit.
 *
 * @see https://developers.google.com/maps/documentation/routes/compute_route_directions
 *
 * @param apiKey - Google Maps Platform API key (Routes API enabled).
 * @param query  - Origin / destination / optional arrival time.
 */
export async function getTransitDirections(
  apiKey: string,
  query: TransitQuery,
): Promise<TransitResult> {
  const body: Record<string, unknown> = {
    origin: { address: query.origin },
    destination: { address: query.destination },
    travelMode: "DRIVE",
    languageCode: "ja",
    regionCode: "JP",
    computeAlternativeRoutes: false,
  };

  const res = await fetch(ROUTES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("Routes API HTTP error:", res.status, await res.text());
    return { routes: [], bestRoute: null };
  }

  // biome-ignore lint/suspicious/noExplicitAny: Routes API response
  const data = (await res.json()) as any;

  if (!data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
    return { routes: [], bestRoute: null };
  }

  // Multiplier to approximate public-transport time from driving time.
  // Trains in Japan are often comparable or faster than driving, but
  // walks + waits add overhead. 1.3× is a conservative estimate.
  const TRANSIT_MULTIPLIER = 1.3;

  const routes: TransitRoute[] = data.routes
    // biome-ignore lint/suspicious/noExplicitAny: Routes API route object
    .map((route: any): TransitRoute | null => {
      const leg = route.legs?.[0];
      if (!leg) return null;

      const rawDurationSec = parseDurationSeconds(
        route.duration ?? leg.duration,
      );
      const estimatedMinutes = Math.ceil(
        (rawDurationSec / 60) * TRANSIT_MULTIPLIER,
      );
      const distanceKm = Math.round(
        ((route.distanceMeters ?? leg.distanceMeters ?? 0) as number) / 1000,
      );

      const departureTime = jstNowHHmm();
      const arrivalTime = jstTimeAfterMinutes(estimatedMinutes);

      // biome-ignore lint/suspicious/noExplicitAny: Routes API step
      const steps = (leg.steps ?? []).map((step: any) => ({
        mode: "DRIVE" as const,
        instruction:
          (step.navigationInstruction?.instructions as string)?.replace(
            /<[^>]*>/g,
            "",
          ) ?? "",
        durationMinutes: Math.ceil(
          parseDurationSeconds(step.staticDuration ?? step.duration) / 60,
        ),
      }));

      return {
        departureTime,
        arrivalTime,
        durationMinutes: estimatedMinutes,
        summary: `車で約${distanceKm}km（推定${estimatedMinutes}分・乗換含む概算）`,
        steps,
      };
    })
    .filter(Boolean) as TransitRoute[];

  return {
    routes,
    bestRoute: routes[0] ?? null,
  };
}
