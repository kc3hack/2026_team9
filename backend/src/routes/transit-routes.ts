import type { Context } from "hono";
import { getTransitDirections } from "../features/transit/transit.service";
import { getAuthSession } from "../lib/session";
import type { App } from "../types/app";

export function registerTransitRoutes(app: App): void {
  /**
   * POST /transit/directions
   *
   * Look up transit directions between two points.
   * Body: { origin: string, destination: string, arrivalTime?: string }
   *
   * `arrivalTime` is an ISO-8601 datetime.  When provided the API will
   * calculate routes that arrive by that time (useful for "what time should
   * I leave to arrive at 09:00?").
   */
  app.post("/transit/directions", async (c: Context<{ Bindings: Env }>) => {
    const session = await getAuthSession(c);
    if (!session) {
      return c.json({ error: "Authentication required." }, 401);
    }

    const body = await c.req.json().catch(() => null);
    if (
      !body ||
      typeof body.origin !== "string" ||
      typeof body.destination !== "string" ||
      body.origin.trim().length === 0 ||
      body.destination.trim().length === 0
    ) {
      return c.json(
        {
          error:
            "Request body must include non-empty `origin` and `destination` strings.",
        },
        400,
      );
    }

    const apiKey = c.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return c.json({ error: "Transit service is not configured." }, 503);
    }

    const result = await getTransitDirections(apiKey, {
      origin: body.origin.trim(),
      destination: body.destination.trim(),
      arrivalTime:
        typeof body.arrivalTime === "string" ? body.arrivalTime : undefined,
    });

    return c.json(result);
  });
}
