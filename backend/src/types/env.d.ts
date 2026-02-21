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
}
