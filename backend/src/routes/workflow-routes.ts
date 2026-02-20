import { toRequestPayload } from "../features/task-decompose/task-decompose.validation";
import { getAuthSession } from "../lib/session";
import type { App } from "../types/app";

export function registerWorkflowRoutes(app: App): void {
  app.post("/workflows/decompose", async (c) => {
    const authSession = await getAuthSession(c);
    if (!authSession) {
      return c.json({ error: "Authentication required." }, 401);
    }

    const body = await c.req.json().catch(() => null);
    const payload = toRequestPayload(body);
    if (!payload) {
      return c.json(
        { error: "Request body must include a non-empty `task` field." },
        400,
      );
    }

    const instance = await c.env.MY_WORKFLOW.create({
      params: {
        ...payload,
        userId: authSession.user.id,
      },
    });
    return c.json(
      {
        id: instance.id,
        status: await instance.status(),
      },
      202,
    );
  });

  app.get("/workflows/:id", async (c) => {
    const authSession = await getAuthSession(c);
    if (!authSession) {
      return c.json({ error: "Authentication required." }, 401);
    }

    const id = c.req.param("id");
    const instance = await c.env.MY_WORKFLOW.get(id);
    return c.json({
      id,
      status: await instance.status(),
    });
  });
}
