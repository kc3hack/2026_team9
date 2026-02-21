import type {
  TransitQuery,
  TransitResult,
  TransitRoute,
  TransitStep,
} from "./transit.types";

// ---------------------------------------------------------------------------
// Routes API helpers
// ---------------------------------------------------------------------------

const ROUTES_API_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

/**
 * Field mask — tells Routes API which fields to return.
 * Keep it minimal to reduce response size and billing.
 */
const FIELD_MASK = [
  "routes.duration",
  "routes.legs.duration",
  "routes.legs.steps.transitDetails",
  "routes.legs.steps.travelMode",
  "routes.legs.steps.navigationInstruction",
  "routes.legs.steps.localizedValues",
  "routes.legs.departureTime",
  "routes.legs.arrivalTime",
  "routes.localizedValues",
].join(",");

/** Format an ISO-8601 datetime to RFC 3339 (what Routes API expects). */
function toRfc3339(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString();
}

/** "123s" → number of seconds. */
function parseDurationSeconds(dur: unknown): number {
  if (typeof dur === "string") {
    return Number.parseInt(dur.replace("s", ""), 10) || 0;
  }
  if (typeof dur === "number") return dur;
  return 0;
}

/** Format a datetime string to "H:mm" display (JST). */
function toDisplayTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // JST = UTC+9
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const h = jst.getUTCHours();
  const m = jst.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

/**
 * Look up transit directions via the **Google Routes API**
 * (`routes.googleapis.com`).
 *
 * This is the successor to the legacy Directions API.
 * Cost: covered by the $200/month free Google Maps Platform credit.
 *
 * @see https://developers.google.com/maps/documentation/routes/compute_route_directions
 *
 * @param apiKey - Google Maps Platform API key (restricted to Routes API).
 * @param query  - Origin / destination / optional arrival time.
 */
export async function getTransitDirections(
  apiKey: string,
  query: TransitQuery,
): Promise<TransitResult> {
  // biome-ignore lint/suspicious/noExplicitAny: Routes API request body
  const body: Record<string, any> = {
    origin: {
      address: query.origin,
    },
    destination: {
      address: query.destination,
    },
    travelMode: "TRANSIT",
    languageCode: "ja",
    regionCode: "JP",
    computeAlternativeRoutes: true,
  };

  if (query.arrivalTime) {
    body.arrivalTime = toRfc3339(query.arrivalTime);
  }

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

  if (!data.routes || !Array.isArray(data.routes)) {
    return { routes: [], bestRoute: null };
  }

  const routes: TransitRoute[] = data.routes
    // biome-ignore lint/suspicious/noExplicitAny: Routes API route object
    .map((route: any): TransitRoute | null => {
      const leg = route.legs?.[0];
      if (!leg) return null;

      // biome-ignore lint/suspicious/noExplicitAny: Routes API step
      const steps: TransitStep[] = (leg.steps ?? []).map((step: any) => {
        const td = step.transitDetails;
        const mode: string = (step.travelMode as string) ?? "UNKNOWN";

        return {
          mode,
          instruction:
            (step.navigationInstruction?.instructions as string)?.replace(
              /<[^>]*>/g,
              "",
            ) ?? "",
          durationMinutes: Math.ceil(
            parseDurationSeconds(step.staticDuration ?? leg.duration) / 60,
          ),
          transitDetails: td
            ? {
                line:
                  (td.transitLine?.nameShort as string) ??
                  (td.transitLine?.name as string) ??
                  "",
                departureStop: (td.stopDetails?.departureStop?.name as string) ?? "",
                arrivalStop: (td.stopDetails?.arrivalStop?.name as string) ?? "",
                numStops: (td.stopCount as number) ?? 0,
              }
            : undefined,
        } satisfies TransitStep;
      });

      return {
        departureTime:
          toDisplayTime(leg.departureTime) ||
          ((leg.localizedValues?.departureTime?.text as string) ?? ""),
        arrivalTime:
          toDisplayTime(leg.arrivalTime) ||
          ((leg.localizedValues?.arrivalTime?.text as string) ?? ""),
        durationMinutes: Math.ceil(
          parseDurationSeconds(route.duration ?? leg.duration) / 60,
        ),
        summary:
          (route.description as string) ??
          (route.localizedValues?.duration?.text as string) ??
          "",
        steps,
      };
    })
    .filter(Boolean) as TransitRoute[];

  return {
    routes,
    bestRoute: routes[0] ?? null,
  };
}
