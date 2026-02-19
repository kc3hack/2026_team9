"use client";

export type SessionResponse = {
  session: {
    id: string;
    userId: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
} | null;

const defaultLocalApiBaseUrl = "http://localhost:8787";

export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

function inferApiBaseUrlFromRuntime(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const { hostname } = window.location;
  if (isLocalHost(hostname)) {
    return defaultLocalApiBaseUrl;
  }

  // Non-local environments should use NEXT_PUBLIC_API_BASE_URL.
  return null;
}

function resolveApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (value && value.length > 0) {
    return value;
  }

  const inferred = inferApiBaseUrlFromRuntime();
  return inferred && inferred.length > 0 ? inferred : defaultLocalApiBaseUrl;
}

function authEndpoint(path: string): string {
  return `${resolveApiBaseUrl()}/api/auth${path}`;
}

async function toApiError(
  response: Response,
  fallbackMessage: string,
): Promise<AuthApiError> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return new AuthApiError(fallbackMessage, response.status);
  }

  const payload = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;
  const message =
    payload && typeof payload.message === "string" && payload.message.trim()
      ? payload.message
      : fallbackMessage;

  return new AuthApiError(message, response.status);
}

export async function getSession(): Promise<SessionResponse> {
  const response = await fetch(authEndpoint("/get-session"), {
    method: "GET",
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw await toApiError(
      response,
      `Failed to load session (${response.status}).`,
    );
  }

  return (await response.json()) as SessionResponse;
}

export async function signInWithGoogle(callbackUrl: string): Promise<void> {
  const response = await fetch(authEndpoint("/sign-in/social"), {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      provider: "google",
      callbackURL: callbackUrl,
      disableRedirect: true,
    }),
  });

  if (!response.ok) {
    throw await toApiError(
      response,
      `Failed to start Google sign-in (${response.status}).`,
    );
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) {
    throw new Error("Google sign-in redirect URL was not returned.");
  }

  window.location.assign(data.url);
}

export async function signOut(): Promise<void> {
  const response = await fetch(authEndpoint("/sign-out"), {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw await toApiError(
      response,
      `Failed to sign out (${response.status}).`,
    );
  }
}
