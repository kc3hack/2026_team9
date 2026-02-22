import type { Context } from "hono";
import { Hono } from "hono";
import { getAllowedOrigins, isAllowedOrigin } from "./lib/origins";
import { registerAuthRoutes } from "./routes/auth-routes";
import { registerBriefingRoutes } from "./routes/briefing-routes";
import { registerCalendarRoutes } from "./routes/calendar-routes";
import { registerMorningRoutineRoutes } from "./routes/morning-routine-routes";
import { registerRootRoutes } from "./routes/root-routes";
import { registerTaskRoutes } from "./routes/task-routes";
import { registerTransitRoutes } from "./routes/transit-routes";
import { registerWorkflowRoutes } from "./routes/workflow-routes";
import type { App } from "./types/app";

function applyCorsHeaders(c: Context<{ Bindings: Env }>, origin: string): void {
  const requestedHeaders = c.req.header("access-control-request-headers");
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Credentials", "true");
  c.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  c.header(
    "Access-Control-Allow-Headers",
    requestedHeaders ?? "Content-Type,Authorization,Accept",
  );
  c.header("Access-Control-Max-Age", "86400");
  c.header("Vary", "Origin");
}

export function createApp(): App {
  const app = new Hono<{ Bindings: Env }>();

  app.use("*", async (c, next) => {
    const originHeader = c.req.header("origin");
    const allowedOrigins = new Set<string>(getAllowedOrigins(c.env));
    const allowedOrigin =
      originHeader && isAllowedOrigin(originHeader, allowedOrigins)
        ? originHeader
        : null;

    if (c.req.method === "OPTIONS") {
      if (allowedOrigin) {
        applyCorsHeaders(c, allowedOrigin);
      }
      return c.body(null, 204);
    }

    try {
      await next();
    } finally {
      if (allowedOrigin) {
        applyCorsHeaders(c, allowedOrigin);
      }
    }
  });

  registerRootRoutes(app);
  registerAuthRoutes(app);
  registerBriefingRoutes(app);
  registerMorningRoutineRoutes(app);
  registerCalendarRoutes(app);
  registerTaskRoutes(app);
  registerTransitRoutes(app);
  registerWorkflowRoutes(app);

  return app;
}
