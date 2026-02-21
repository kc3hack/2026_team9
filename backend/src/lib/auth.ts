import { betterAuth } from "better-auth";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { getAllowedOrigins } from "./origins";

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const authDbClients = new WeakMap<
  D1Database,
  Kysely<Record<string, unknown>>
>();

function getAuthDatabaseClient(
  db: D1Database,
): Kysely<Record<string, unknown>> {
  const cached = authDbClients.get(db);
  if (cached) {
    return cached;
  }

  const client = new Kysely<Record<string, unknown>>({
    dialect: new D1Dialect({ database: db }),
  });
  authDbClients.set(db, client);
  return client;
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required auth env var: ${name}`);
  }

  return value;
}

export function createAuth(env: Env, request?: Request) {
  const configuredBaseURL = env.BETTER_AUTH_URL?.trim();
  const configuredCookiePrefix = env.AUTH_COOKIE_PREFIX?.trim();
  const runtimeOrigin = (() => {
    try {
      return request ? new URL(request.url).origin : undefined;
    } catch {
      return undefined;
    }
  })();
  const runtimeIsLocal = (() => {
    if (!runtimeOrigin) {
      return false;
    }
    try {
      const host = new URL(runtimeOrigin).hostname;
      return host === "localhost" || host === "127.0.0.1" || host === "::1";
    } catch {
      return false;
    }
  })();
  const baseURL = runtimeIsLocal
    ? runtimeOrigin
    : configuredBaseURL && configuredBaseURL.length > 0
      ? configuredBaseURL
      : runtimeOrigin;
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
  const advancedOptions =
    enableCrossSubDomainCookies || configuredCookiePrefix
      ? {
          ...(configuredCookiePrefix
            ? {
                cookiePrefix: configuredCookiePrefix,
              }
            : {}),
          ...(enableCrossSubDomainCookies
            ? {
                crossSubDomainCookies: {
                  enabled: true,
                  domain: env.AUTH_COOKIE_DOMAIN,
                },
              }
            : {}),
        }
      : undefined;

  return betterAuth({
    secret: required("BETTER_AUTH_SECRET", env.BETTER_AUTH_SECRET),
    baseURL: baseURL && baseURL.length > 0 ? baseURL : undefined,
    trustedOrigins: getAllowedOrigins(env),
    database: {
      db: getAuthDatabaseClient(env.AUTH_DB),
      type: "sqlite",
    },
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      google: {
        clientId: required("GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID),
        clientSecret: required(
          "GOOGLE_CLIENT_SECRET",
          env.GOOGLE_CLIENT_SECRET,
        ),
        accessType: "offline",
        prompt: "select_account consent",
        scope: ["openid", "email", "profile", GOOGLE_CALENDAR_SCOPE],
      },
    },
    account: {
      encryptOAuthTokens: true,
    },
    advanced: advancedOptions,
  });
}
