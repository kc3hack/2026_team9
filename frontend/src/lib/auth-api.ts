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

const defaultApiBaseUrl = "http://localhost:8787";

function resolveApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return value && value.length > 0 ? value : defaultApiBaseUrl;
}

function authEndpoint(path: string): string {
  return `${resolveApiBaseUrl()}/api/auth${path}`;
}

export async function getSession(): Promise<SessionResponse> {
  const response = await fetch(authEndpoint("/get-session"), {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to load session (${response.status}).`);
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
    throw new Error(`Failed to start Google sign-in (${response.status}).`);
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
  });

  if (!response.ok) {
    throw new Error(`Failed to sign out (${response.status}).`);
  }
}
