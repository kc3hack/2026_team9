import type { WeatherInfo } from "./weather.types";

// ---------------------------------------------------------------------------
// Defaults & thresholds
// ---------------------------------------------------------------------------

/** Kyoto Station (fallback when geocoding fails and no ENV override). */
const FALLBACK_LAT = 34.9858;
const FALLBACK_LON = 135.7588;
const FALLBACK_NAME = "京都駅（デフォルト）";

const DEFAULT_PROB_THRESHOLD = 50; // %
const DEFAULT_MM_THRESHOLD = 0.2; // mm/h

// ---------------------------------------------------------------------------
// Geocoding  (Open-Meteo — no API key required)
// ---------------------------------------------------------------------------

type GeoResult = { lat: number; lon: number; name: string };

/**
 * Resolve a place name to lat/lon via Open-Meteo Geocoding API.
 * Returns `null` on any failure so the caller can fall back.
 *
 * @example
 * ```
 * curl "https://geocoding-api.open-meteo.com/v1/search?name=京都大学&count=1&language=ja&format=json"
 * ```
 */
async function geocode(location: string): Promise<GeoResult | null> {
  try {
    const params = new URLSearchParams({
      name: location,
      count: "1",
      language: "ja",
      format: "json",
    });
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?${params}`,
    );
    if (!res.ok) return null;

    // biome-ignore lint/suspicious/noExplicitAny: Open-Meteo geocoding response
    const data = (await res.json()) as any;
    const first = data?.results?.[0];
    if (!first || typeof first.latitude !== "number") return null;

    return {
      lat: first.latitude as number,
      lon: first.longitude as number,
      name: (first.name as string) ?? location,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Forecast  (Open-Meteo — no API key required)
// ---------------------------------------------------------------------------

type HourlySlot = {
  iso: string;
  precipitationProbability: number | null;
  precipitationMm: number | null;
};

/**
 * Fetch today's hourly forecast for the given coordinates.
 *
 * @example
 * ```
 * curl "https://api.open-meteo.com/v1/forecast?latitude=34.98&longitude=135.75&hourly=precipitation_probability,precipitation&timezone=Asia/Tokyo&forecast_days=1"
 * ```
 */
async function fetchHourlyForecast(
  lat: number,
  lon: number,
): Promise<HourlySlot[]> {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      hourly: "precipitation_probability,precipitation",
      timezone: "Asia/Tokyo",
      forecast_days: "1",
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) return [];

    // biome-ignore lint/suspicious/noExplicitAny: Open-Meteo forecast response
    const data = (await res.json()) as any;
    const hourly = data?.hourly;
    if (!hourly?.time || !Array.isArray(hourly.time)) return [];

    const times: string[] = hourly.time;
    const probs: (number | null)[] = hourly.precipitation_probability ?? [];
    const mms: (number | null)[] = hourly.precipitation ?? [];

    return times.map((iso, i) => ({
      iso,
      precipitationProbability: typeof probs[i] === "number" ? probs[i] : null,
      precipitationMm: typeof mms[i] === "number" ? mms[i] : null,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Pick the right hourly slot
// ---------------------------------------------------------------------------

/**
 * Find the hourly slot closest to `targetHHmm` (e.g. "08:12").
 * Open-Meteo returns times like "2026-02-22T08:00" so we match on the hour.
 */
function pickSlot(slots: HourlySlot[], targetHHmm: string): HourlySlot | null {
  if (slots.length === 0) return null;

  const [hStr] = targetHHmm.split(":");
  const targetHour = Number(hStr ?? 0);

  // Find the slot whose hour matches (or is closest)
  let best: HourlySlot | null = null;
  let bestDiff = Number.MAX_SAFE_INTEGER;

  for (const slot of slots) {
    // Open-Meteo returns "2026-02-22T08:00" — extract hour
    const match = slot.iso.match(/T(\d{2})/);
    if (!match) continue;
    const slotHour = Number(match[1]);
    const diff = Math.abs(slotHour - targetHour);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = slot;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Umbrella decision
// ---------------------------------------------------------------------------

function decideUmbrella(
  slot: HourlySlot | null,
  probThreshold: number,
  mmThreshold: number,
): Pick<
  WeatherInfo,
  "umbrellaNeeded" | "reason" | "precipitationProbability" | "precipitationMm"
> {
  if (!slot) {
    return {
      precipitationProbability: null,
      precipitationMm: null,
      umbrellaNeeded: false,
      reason: "天気情報を取得できませんでした",
    };
  }

  const prob = slot.precipitationProbability;
  const mm = slot.precipitationMm;

  // Rule 1: precipitation probability
  if (prob !== null && prob >= probThreshold) {
    return {
      precipitationProbability: prob,
      precipitationMm: mm,
      umbrellaNeeded: true,
      reason: `降水確率 ${prob}% のため`,
    };
  }

  // Rule 2: precipitation amount
  if (mm !== null && mm >= mmThreshold) {
    return {
      precipitationProbability: prob,
      precipitationMm: mm,
      umbrellaNeeded: true,
      reason: `雨量 ${mm}mm/h のため`,
    };
  }

  // No rain expected
  const parts: string[] = [];
  if (prob !== null) parts.push(`降水確率 ${prob}%`);
  if (mm !== null) parts.push(`雨量 ${mm}mm/h`);
  const detail = parts.length > 0 ? parts.join("・") : "データなし";

  return {
    precipitationProbability: prob,
    precipitationMm: mm,
    umbrellaNeeded: false,
    reason: `${detail} — 傘は不要`,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get weather / umbrella info for a location at a given time.
 *
 * Never throws — returns a safe fallback on any error so the morning
 * briefing is never disrupted by weather failures.
 *
 * @param location  - Place name or address (used for geocoding).
 * @param targetHHmm - "HH:mm" in JST to look up (e.g. departure time). Falls back to current hour.
 * @param env       - Worker env (optional overrides for lat/lon/thresholds).
 */
export async function getWeather(
  location: string,
  targetHHmm: string,
  env?: Partial<
    Pick<
      Env,
      | "WEATHER_DEFAULT_LAT"
      | "WEATHER_DEFAULT_LON"
      | "WEATHER_UMBRELLA_PROB_THRESHOLD"
      | "WEATHER_UMBRELLA_MM_THRESHOLD"
    >
  >,
): Promise<WeatherInfo> {
  const probThreshold = env?.WEATHER_UMBRELLA_PROB_THRESHOLD
    ? Number(env.WEATHER_UMBRELLA_PROB_THRESHOLD)
    : DEFAULT_PROB_THRESHOLD;
  const mmThreshold = env?.WEATHER_UMBRELLA_MM_THRESHOLD
    ? Number(env.WEATHER_UMBRELLA_MM_THRESHOLD)
    : DEFAULT_MM_THRESHOLD;

  // 1) Geocode the location
  const geo = await geocode(location);
  const lat =
    geo?.lat ??
    (env?.WEATHER_DEFAULT_LAT ? Number(env.WEATHER_DEFAULT_LAT) : FALLBACK_LAT);
  const lon =
    geo?.lon ??
    (env?.WEATHER_DEFAULT_LON ? Number(env.WEATHER_DEFAULT_LON) : FALLBACK_LON);
  const locationName = geo?.name ?? FALLBACK_NAME;

  // 2) Fetch hourly forecast
  const slots = await fetchHourlyForecast(lat, lon);

  // 3) Pick the slot matching the target time
  const slot = pickSlot(slots, targetHHmm);

  // 4) Decide
  const decision = decideUmbrella(slot, probThreshold, mmThreshold);

  return {
    locationName,
    startIso: slot?.iso ?? "",
    ...decision,
  };
}
