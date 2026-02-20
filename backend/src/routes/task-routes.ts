import { decomposeWithWorkersAi } from "../features/task-decompose/task-decompose.service";
import { toRequestPayload } from "../features/task-decompose/task-decompose.validation";
import type { App } from "../types/app";

export function registerTaskRoutes(app: App): void {
  app.post("/tasks/decompose", async (c) => {
    const body = await c.req.json().catch(() => null);
    const payload = toRequestPayload(body);
    if (!payload) {
      return c.json(
        { error: "Request body must include a non-empty `task` field." },
        400,
      );
    }

    const breakdown = await decomposeWithWorkersAi(c.env, payload);
    return c.json({ breakdown });
  });
}
