import type { App } from "../types/app";

export function registerRootRoutes(app: App): void {
  app.get("/", (c) => {
    return c.json({
      service: "task-decomposer-backend",
      endpoints: [
        "ALL /api/auth/*",
        "POST /tasks/decompose",
        "POST /workflows/decompose",
        "GET /workflows/:id",
      ],
    });
  });
}
