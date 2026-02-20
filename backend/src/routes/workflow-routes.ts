import { toRequestPayload } from "../features/task-decompose/task-decompose.validation";
import {
  getWorkflowJob,
  listWorkflowJobs,
  upsertWorkflowJob,
} from "../features/task-decompose/task-workflow.repository";
import { getAuthSession } from "../lib/session";
import type { App } from "../types/app";

function parseLimitQuery(raw: string | undefined): number {
  if (!raw) {
    return 20;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 20;
  }

  const rounded = Math.trunc(parsed);
  if (rounded < 1) {
    return 1;
  }

  return Math.min(rounded, 100);
}

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

    await upsertWorkflowJob(c.env.AUTH_DB, {
      workflowId: instance.id,
      userId: authSession.user.id,
      status: "queued",
      taskInput: payload.task,
      context: payload.context,
      deadline: payload.deadline,
      timezone: payload.timezone,
      errorMessage: null,
      completedAt: null,
    }).catch((error) => {
      console.error("Failed to upsert queued workflow job", {
        workflowId: instance.id,
        userId: authSession.user.id,
        error,
      });
    });

    const [workflowStatus, record] = await Promise.all([
      instance.status(),
      getWorkflowJob(c.env.AUTH_DB, instance.id, authSession.user.id),
    ]);

    return c.json(
      {
        id: instance.id,
        workflowStatus,
        record,
      },
      202,
    );
  });

  app.get("/workflows/history", async (c) => {
    const authSession = await getAuthSession(c);
    if (!authSession) {
      return c.json({ error: "Authentication required." }, 401);
    }

    const limit = parseLimitQuery(c.req.query("limit"));
    const items = await listWorkflowJobs(
      c.env.AUTH_DB,
      authSession.user.id,
      limit,
    );

    return c.json({
      items,
    });
  });

  app.get("/workflows/:id", async (c) => {
    const authSession = await getAuthSession(c);
    if (!authSession) {
      return c.json({ error: "Authentication required." }, 401);
    }

    const id = c.req.param("id");
    const instance = await c.env.MY_WORKFLOW.get(id);
    const [workflowStatus, record] = await Promise.all([
      instance.status(),
      getWorkflowJob(c.env.AUTH_DB, id, authSession.user.id),
    ]);

    return c.json({
      id,
      workflowStatus,
      record,
    });
  });
}
