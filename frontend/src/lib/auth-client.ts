"use client";

import { createAuthClient } from "better-auth/react";

const defaultAuthBaseUrl = "http://127.0.0.1:8787";

function resolveAuthBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return value && value.length > 0 ? value : defaultAuthBaseUrl;
}

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseUrl(),
  fetchOptions: {
    credentials: "include",
  },
});
