import type { Context } from "hono";
import { getMorningBriefing } from "../features/morning-briefing/morning-briefing.service";
import { getAuthSession } from "../lib/session";
import type { App } from "../types/app";

export function registerBriefingRoutes(app: App): void {
  /**
   * POST /briefing/morning
   *
   * Generate a full morning briefing by chaining:
   *   Google Calendar → Transit Directions → Late-risk engine
   *
   * Body: { currentLocation: string, prepMinutes?: number }
   *
   * Returns: MorningBriefingResult
   */
  app.post("/briefing/morning", async (c: Context<{ Bindings: Env }>) => {
    const session = await getAuthSession(c);
    if (!session) {
      return c.json({ error: "Authentication required." }, 401);
    }

    const body = await c.req.json().catch(() => null);
    if (
      !body ||
      typeof body.currentLocation !== "string" ||
      body.currentLocation.trim().length === 0
    ) {
      return c.json(
        {
          error:
            "Request body must include a non-empty `currentLocation` string.",
        },
        400,
      );
    }

    const result = await getMorningBriefing(c.env, session.user.id, {
      currentLocation: body.currentLocation.trim(),
      prepMinutes:
        typeof body.prepMinutes === "number" && body.prepMinutes > 0
          ? body.prepMinutes
          : undefined,
      forceRefresh: body.forceRefresh === true,
    });

    return c.json(result);
  });
}
