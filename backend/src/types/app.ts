import type { Hono } from "hono";

export type App = Hono<{ Bindings: Env }>;
