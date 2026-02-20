import { Hono } from "hono";
import type { Context } from "hono";
import { registerRootRoutes } from "./routes/root-routes";
import { registerAuthRoutes } from "./routes/auth-routes";
import { registerTaskRoutes } from "./routes/task-routes";
import { registerWorkflowRoutes } from "./routes/workflow-routes";
import type { App } from "./types/app";
import { getAllowedOrigins, isAllowedOrigin } from "./lib/origins";

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

		await next();

		if (allowedOrigin) {
			applyCorsHeaders(c, allowedOrigin);
		}
	});

	registerRootRoutes(app);
	registerAuthRoutes(app);
	registerTaskRoutes(app);
	registerWorkflowRoutes(app);

	return app;
}
