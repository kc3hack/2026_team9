interface Env {
  AUTH_DB: D1Database;
  AI: Ai;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** Google Maps Platform API key (Directions API). */
  GOOGLE_MAPS_API_KEY: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  AUTH_COOKIE_PREFIX?: string;
  FRONTEND_ORIGINS?: string;
  AUTH_COOKIE_DOMAIN?: string;
  /** Fallback latitude when geocoding fails (default: Kyoto Station). */
  WEATHER_DEFAULT_LAT?: string;
  /** Fallback longitude when geocoding fails (default: Kyoto Station). */
  WEATHER_DEFAULT_LON?: string;
  /** Precipitation probability threshold for umbrella (default: 50). */
  WEATHER_UMBRELLA_PROB_THRESHOLD?: string;
  /** Precipitation mm/h threshold for umbrella (default: 0.2). */
  WEATHER_UMBRELLA_MM_THRESHOLD?: string;
}
