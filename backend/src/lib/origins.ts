const LOCAL_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function parseOrigin(value: string | undefined): string | null {
	if (!value || value.trim().length === 0) {
		return null;
	}

	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
}

function parseCsvOrigins(value?: string): string[] {
	if (!value) {
		return [];
	}

	return value
		.split(",")
		.map((origin) => origin.trim())
		.filter((origin) => origin.length > 0)
		.map(parseOrigin)
		.filter((origin): origin is string => origin !== null);
}

export function getAllowedOrigins(env: Env): string[] {
	const allowed = new Set<string>(LOCAL_DEV_ORIGINS);
	for (const origin of parseCsvOrigins(env.FRONTEND_ORIGINS)) {
		allowed.add(origin);
	}

	const authOrigin = parseOrigin(env.BETTER_AUTH_URL);
	if (authOrigin) {
		allowed.add(authOrigin);
	}

	return [...allowed];
}

export function isAllowedOrigin(origin: string, allowedOrigins: Set<string>): boolean {
	if (allowedOrigins.has(origin)) {
		return true;
	}

	try {
		const url = new URL(origin);
		// Allow loopback origins with arbitrary ports for local development tools.
		// This fallback is limited to localhost/127.0.0.1/::1 only.
		return (
			(url.protocol === "http:" || url.protocol === "https:") &&
			LOCAL_DEV_HOSTS.has(url.hostname)
		);
	} catch {
		return false;
	}
}
