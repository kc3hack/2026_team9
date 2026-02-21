import type {
  TransitQuery,
  TransitResult,
  TransitRoute,
  TransitStep,
} from "./transit.types";

/**
 * Look up transit directions between two points via the
 * Google Directions API (`mode=transit`).
 *
 * Cost: covered by the $200/month free Google Maps Platform credit.
 *
 * @param apiKey - Google Maps Platform API key (server-side, restricted to Directions API).
 * @param query  - Origin / destination / optional arrival time.
 */
export async function getTransitDirections(
  apiKey: string,
  query: TransitQuery,
): Promise<TransitResult> {
  const params = new URLSearchParams({
    origin: query.origin,
    destination: query.destination,
    mode: "transit",
    language: "ja",
    region: "jp",
    alternatives: "true",
    key: apiKey,
  });

  if (query.arrivalTime) {
    const arrivalTs = Math.floor(
      new Date(query.arrivalTime).getTime() / 1000,
    );
    params.set("arrival_time", arrivalTs.toString());
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?${params}`,
  );

  if (!res.ok) {
    console.error("Directions API HTTP error:", res.status);
    return { routes: [], bestRoute: null };
  }

  // biome-ignore lint/suspicious/noExplicitAny: Google Directions API response
  const data = (await res.json()) as any;

  if (data.status !== "OK") {
    console.error("Directions API status:", data.status, data.error_message);
    return { routes: [], bestRoute: null };
  }

  const routes: TransitRoute[] = (data.routes ?? [])
    // biome-ignore lint/suspicious/noExplicitAny: Google Directions route
    .map((route: any): TransitRoute | null => {
      const leg = route.legs?.[0];
      if (!leg) return null;

      // biome-ignore lint/suspicious/noExplicitAny: Google Directions step
      const steps: TransitStep[] = (leg.steps ?? []).map((step: any) => {
        const td = step.transit_details;
        return {
          mode: (step.travel_mode as string) ?? "UNKNOWN",
          instruction:
            (step.html_instructions as string)?.replace(/<[^>]*>/g, "") ?? "",
          durationMinutes: Math.ceil(
            ((step.duration?.value as number) ?? 0) / 60,
          ),
          transitDetails: td
            ? {
                line:
                  (td.line?.short_name as string) ??
                  (td.line?.name as string) ??
                  "",
                departureStop: (td.departure_stop?.name as string) ?? "",
                arrivalStop: (td.arrival_stop?.name as string) ?? "",
                numStops: (td.num_stops as number) ?? 0,
              }
            : undefined,
        } satisfies TransitStep;
      });

      return {
        departureTime: (leg.departure_time?.text as string) ?? "",
        arrivalTime: (leg.arrival_time?.text as string) ?? "",
        durationMinutes: Math.ceil(
          ((leg.duration?.value as number) ?? 0) / 60,
        ),
        summary: (route.summary as string) ?? "",
        steps,
      };
    })
    .filter(Boolean) as TransitRoute[];

  return {
    routes,
    bestRoute: routes[0] ?? null,
  };
}
