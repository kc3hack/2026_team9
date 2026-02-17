import { betterAuth } from "better-auth";
import { getAllowedOrigins } from "./origins";

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function required(name: string, value: string | undefined): string {
	if (!value || value.trim().length === 0) {
		throw new Error(`Missing required auth env var: ${name}`);
	}

	return value;
}

export function createAuth(env: Env, request?: Request) {
	const baseURL = env.BETTER_AUTH_URL?.trim();
	const runtimeRequestHost = (() => {
		try {
			return request ? new URL(request.url).hostname : undefined;
		} catch {
			return undefined;
		}
	})();
	const configuredBaseHost = (() => {
		try {
			return baseURL ? new URL(baseURL).hostname : undefined;
		} catch {
			return undefined;
		}
	})();
	const hostForCookieValidation = runtimeRequestHost ?? configuredBaseHost;
	const enableCrossSubDomainCookies =
		Boolean(env.AUTH_COOKIE_DOMAIN) &&
		hostForCookieValidation !== "localhost" &&
		hostForCookieValidation !== "127.0.0.1";

	return betterAuth({
		secret: required("BETTER_AUTH_SECRET", env.BETTER_AUTH_SECRET),
		baseURL: baseURL && baseURL.length > 0 ? baseURL : undefined,
		trustedOrigins: getAllowedOrigins(env),
		database: env.AUTH_DB,
		emailAndPassword: {
			enabled: false,
		},
		socialProviders: {
			google: {
				clientId: required("GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID),
				clientSecret: required("GOOGLE_CLIENT_SECRET", env.GOOGLE_CLIENT_SECRET),
				accessType: "offline",
				prompt: "select_account consent",
				scope: ["openid", "email", "profile", GOOGLE_CALENDAR_SCOPE],
			},
		},
		account: {
			encryptOAuthTokens: true,
		},
		advanced: enableCrossSubDomainCookies
			? {
					crossSubDomainCookies: {
						enabled: true,
						domain: env.AUTH_COOKIE_DOMAIN,
					},
				}
			: undefined,
	});
}
