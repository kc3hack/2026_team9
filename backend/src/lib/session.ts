import type { Context } from "hono";
import { createAuth } from "./auth";

export type AuthSession = {
	user: {
		id: string;
		email: string;
		name: string;
		image?: string | null;
	};
	session: {
		id: string;
		userId: string;
	};
};

export async function getAuthSession(
	c: Context<{ Bindings: Env }>,
): Promise<AuthSession | null> {
	const auth = createAuth(c.env, c.req.raw);
	const session = await auth.api.getSession({
		headers: c.req.raw.headers,
	});

	if (!session) {
		return null;
	}

	return session as AuthSession;
}
