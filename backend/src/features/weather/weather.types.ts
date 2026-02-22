/** Weather information for the umbrella decision. */
export type WeatherInfo = {
  /** Resolved location name (from geocoding, or fallback). */
  locationName: string;
  /** ISO-8601 datetime of the hourly slot referenced. */
  startIso: string;
  /** Precipitation probability 0–100, or null if unavailable. */
  precipitationProbability: number | null;
  /** Precipitation in mm/h, or null if unavailable. */
  precipitationMm: number | null;
  /** Whether an umbrella is recommended. */
  umbrellaNeeded: boolean;
  /** Human-readable reason for the decision. */
  reason: string;
};
