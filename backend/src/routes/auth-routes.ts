import type { Context } from "hono";
import { createAuth } from "../lib/auth";
import type { App } from "../types/app";

async function handleAuthRequest(c: Context<{ Bindings: Env }>): Promise<Response> {
	const auth = createAuth(c.env, c.req.raw);
	return auth.handler(c.req.raw);
}

export function registerAuthRoutes(app: App): void {
	app.all("/api/auth", handleAuthRequest);
	app.all("/api/auth/*", handleAuthRequest);
}
