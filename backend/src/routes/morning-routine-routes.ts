import {
  getMorningRoutine,
  saveMorningRoutine,
  validateMorningRoutineItems,
} from "../features/morning-routine/morning-routine.service";
import { getAuthSession } from "../lib/session";
import type { App } from "../types/app";

export function registerMorningRoutineRoutes(app: App): void {
  app.get("/briefing/routine", async (c) => {
    const authSession = await getAuthSession(c);
    if (!authSession) {
      return c.json({ error: "Authentication required." }, 401);
    }

    const items = await getMorningRoutine(c.env.AUTH_DB, authSession.user.id);
    return c.json({ items });
  });

  app.put("/briefing/routine", async (c) => {
    const authSession = await getAuthSession(c);
    if (!authSession) {
      return c.json({ error: "Authentication required." }, 401);
    }

    const body = await c.req.json().catch(() => null);
    const items = validateMorningRoutineItems(body?.items);
    if (!items) {
      return c.json(
        {
          error:
            "Request body must include non-empty `items` with { id?, label, minutes }.",
        },
        400,
      );
    }

    const saved = await saveMorningRoutine(
      c.env.AUTH_DB,
      authSession.user.id,
      items,
    );
    return c.json({ items: saved });
  });
}
