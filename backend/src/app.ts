import { Hono } from "hono";
import { registerRootRoutes } from "./routes/root-routes";
import { registerTaskRoutes } from "./routes/task-routes";
import { registerWorkflowRoutes } from "./routes/workflow-routes";
import type { App } from "./types/app";

export function createApp(): App {
	const app = new Hono<{ Bindings: Env }>();

	registerRootRoutes(app);
	registerTaskRoutes(app);
	registerWorkflowRoutes(app);

	return app;
}
