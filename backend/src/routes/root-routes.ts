import type { App } from "../types/app";

export function registerRootRoutes(app: App): void {
  app.get("/", (c) => {
    return c.json({
      service: "task-decomposer-backend",
      endpoints: [
        "ALL /api/auth/*",
        "POST /briefing/morning",
        "GET /briefing/routine",
        "PUT /briefing/routine",
        "GET /calendar/today",
        "POST /transit/directions",
        "POST /tasks/decompose",
        "POST /workflows/decompose",
        "GET /workflows/history",
        "GET /workflows/:id",
      ],
    });
  });
}
