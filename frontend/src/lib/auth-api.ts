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
const authErrorQueryKeys = ["error", "error_description", "state"];
const oauthErrorMessageByCode: Record<string, string> = {
  access_denied:
    "Googleログインがキャンセルされたか、必要な権限が拒否されました。もう一度ログインしてください。",
  invalid_request:
    "認証リクエストが不正です。ページを再読み込みして再試行してください。",
  unauthorized_client:
    "このアプリの認可設定に問題があります。管理者へ連絡してください。",
  unsupported_response_type:
    "認証フローの種類が不正です。時間をおいて再試行してください。",
  invalid_scope:
    "必要なGoogle権限が不足しています。再度ログインして権限を許可してください。",
  server_error:
    "Google認証サーバーでエラーが発生しました。時間をおいて再試行してください。",
  temporarily_unavailable:
    "Google認証サーバーが一時的に利用できません。時間をおいて再試行してください。",
  oauth_code_missing:
    "認証コードを受け取れませんでした。もう一度ログインしてください。",
  oauth_code_verification_failed:
    "OAuth認証コードの検証に失敗しました。時間をおいて再試行してください。",
  state_mismatch:
    "認証セッションの検証に失敗しました。ページを再読み込みして再度ログインしてください。",
  please_restart_the_process:
    "認証セッションが失効した可能性があります。最初からログインをやり直してください。",
  user_info_is_missing:
    "Googleアカウント情報を取得できませんでした。時間をおいて再試行してください。",
  email_is_missing: "Googleアカウントのメール情報を取得できませんでした。",
  name_is_missing: "Googleアカウントの表示名を取得できませんでした。",
  "email_doesn't_match":
    "ログイン中ユーザーとGoogleアカウントのメールが一致しませんでした。",
  account_already_linked_to_different_user:
    "このGoogleアカウントは別ユーザーに連携済みです。",
  unable_to_link_account:
    "Googleアカウントの連携に失敗しました。時間をおいて再試行してください。",
  banned: "このアカウントでは現在ログインできません。",
};

export type AuthCallbackError = {
  code: string;
  description: string | null;
  message: string;
};

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
  if (inferred && inferred.length > 0) {
    return inferred;
  }

  if (typeof window !== "undefined" && !isLocalHost(window.location.hostname)) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is required for non-local environments.",
    );
  }

  return defaultLocalApiBaseUrl;
}

function authEndpoint(path: string): string {
  return `${resolveApiBaseUrl()}/api/auth${path}`;
}

function stripAuthErrorParamsFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const hasAuthErrorParam =
      url.searchParams.has("error") ||
      url.searchParams.has("error_description");
    if (!hasAuthErrorParam) {
      return rawUrl;
    }

    for (const key of authErrorQueryKeys) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function normalizeOAuthErrorCode(code: string): string {
  return code.trim().toLowerCase();
}

function toAuthCallbackErrorMessage(
  code: string,
  description: string | null,
): string {
  const normalizedCode = normalizeOAuthErrorCode(code);
  const knownMessage = oauthErrorMessageByCode[normalizedCode];
  if (knownMessage) {
    return knownMessage;
  }

  const detail =
    description && description.trim().length > 0
      ? ` 詳細: ${description.trim()}`
      : "";
  return `Googleログインに失敗しました (${code}).${detail}`;
}

export function consumeAuthCallbackErrorFromUrl(
  currentUrl: string,
): AuthCallbackError | null {
  try {
    const url = new URL(currentUrl);
    const code = url.searchParams.get("error")?.trim();
    if (!code) {
      return null;
    }

    const description = url.searchParams.get("error_description");
    for (const key of authErrorQueryKeys) {
      url.searchParams.delete(key);
    }

    if (typeof window !== "undefined") {
      const cleanedPath = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(
        window.history.state,
        document.title,
        cleanedPath,
      );
    }

    return {
      code,
      description,
      message: toAuthCallbackErrorMessage(code, description),
    };
  } catch {
    return null;
  }
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
  const sanitizedCallbackUrl = stripAuthErrorParamsFromUrl(callbackUrl);

  const response = await fetch(authEndpoint("/sign-in/social"), {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      provider: "google",
      callbackURL: sanitizedCallbackUrl,
      errorCallbackURL: sanitizedCallbackUrl,
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
    // Better Auth expects application/json for this endpoint.
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw await toApiError(
      response,
      `Failed to sign out (${response.status}).`,
    );
  }
}
