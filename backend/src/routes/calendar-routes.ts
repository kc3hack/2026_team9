import { getTodayEvents } from "../features/google-calendar/google-calendar.service";
import { getAuthSession } from "../lib/session";
import type { App } from "../types/app";

export function registerCalendarRoutes(app: App): void {
  /**
   * GET /calendar/today
   *
   * Returns today's Google Calendar events for the authenticated user.
   * Requires a valid session cookie (Better Auth).
   */
  app.get("/calendar/today", async (c) => {
    const session = await getAuthSession(c);
    if (!session) {
      return c.json({ error: "Authentication required." }, 401);
    }

    const result = await getTodayEvents(c.env, session.user.id);
    return c.json(result);
  });
}
