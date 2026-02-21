"use client";

import {
  Badge,
  Box,
  Button,
  HStack,
  Link,
  List,
  Stack,
  Text,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AuthApiError,
  consumeAuthCallbackErrorFromUrl,
  getSession,
  type SessionResponse,
  signInWithGoogle,
  signOut,
} from "@/lib/auth-api";

type AuthAction = "session" | "signIn" | "signOut";
type AuthPanelProps = {
  onSessionChanged?: (session: SessionResponse) => void;
};

function fallbackMessage(action: AuthAction): string {
  if (action === "session") {
    return "セッション状態を確認できませんでした。時間をおいて再試行してください。";
  }
  if (action === "signIn") {
    return "ログイン処理を開始できませんでした。時間をおいて再試行してください。";
  }
  return "ログアウトに失敗しました。時間をおいて再試行してください。";
}

function toErrorMessage(error: unknown, action: AuthAction): string {
  if (error instanceof TypeError) {
    return "ネットワークに接続できませんでした。通信環境を確認してください。";
  }

  if (error instanceof AuthApiError) {
    if (error.status >= 500) {
      return "サーバーエラーが発生しました。時間をおいて再試行してください。";
    }
    if (error.status >= 400) {
      return fallbackMessage(action);
    }
  }

  return fallbackMessage(action);
}

export function AuthPanel({ onSessionChanged }: AuthPanelProps) {
  const [session, setSession] = useState<SessionResponse>(null);
  const [isPending, setIsPending] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [oauthCallbackError, setOAuthCallbackError] = useState<string | null>(
    null,
  );
  const [isActionRunning, setIsActionRunning] = useState(false);

  const signedInUser = useMemo(() => session?.user ?? null, [session]);
  const displayError = useMemo(
    () => actionError ?? oauthCallbackError ?? sessionError,
    [actionError, oauthCallbackError, sessionError],
  );

  const refreshSession = useCallback(async () => {
    setIsPending(true);
    try {
      const nextSession = await getSession();
      setSession(nextSession);
      onSessionChanged?.(nextSession);
      setSessionError(null);
      if (nextSession) {
        setActionError(null);
        setOAuthCallbackError(null);
      }
    } catch (error) {
      setSessionError(toErrorMessage(error, "session"));
      setSession(null);
      onSessionChanged?.(null);
    } finally {
      setIsPending(false);
    }
  }, [onSessionChanged]);

  useEffect(() => {
    const callbackError = consumeAuthCallbackErrorFromUrl(window.location.href);
    if (!callbackError) {
      return;
    }

    setOAuthCallbackError(callbackError.message);
  }, []);

  useEffect(() => {
    // refreshSession is stable (useCallback with empty deps), so this runs on mount.
    void refreshSession();
  }, [refreshSession]);

  const handleSignIn = async () => {
    setActionError(null);
    setSessionError(null);
    setOAuthCallbackError(null);
    setIsActionRunning(true);
    try {
      await signInWithGoogle(window.location.href);
    } catch (error) {
      setActionError(toErrorMessage(error, "signIn"));
    } finally {
      setIsActionRunning(false);
    }
  };

  const handleSignOut = async () => {
    setActionError(null);
    setSessionError(null);
    setIsActionRunning(true);
    try {
      await signOut();
      await refreshSession();
    } catch (error) {
      setActionError(toErrorMessage(error, "signOut"));
    } finally {
      setIsActionRunning(false);
    }
  };

  return (
    <Box
      bg="var(--app-surface)"
      borderWidth="1px"
      borderColor="var(--app-border)"
      borderRadius="2xl"
      p={{ base: 5, md: 7 }}
    >
      <Stack gap={4}>
        <HStack gap={3} justify="space-between" flexWrap="wrap">
          <Text fontWeight="semibold">ユーザー認証</Text>
          <Badge colorPalette={signedInUser ? "green" : "gray"} size="md">
            {isPending
              ? "確認中"
              : signedInUser
                ? "ログイン済み"
                : "未ログイン"}
          </Badge>
        </HStack>

        {signedInUser ? (
          <Stack gap={1}>
            <Text fontSize="sm" color="fg.muted">
              {signedInUser.name}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {signedInUser.email}
            </Text>
          </Stack>
        ) : (
          <Text fontSize="sm" color="fg.muted">
            Google でログインすると Workflow 実行が可能になります。
          </Text>
        )}

        {!signedInUser ? (
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor="var(--app-border)"
            p={4}
          >
            <Stack gap={2}>
              <Text fontSize="sm" fontWeight="semibold">
                権限許可後に実行される処理
              </Text>
              <List.Root gap={1} ps={4}>
                <List.Item fontSize="sm" color="fg.muted">
                  入力タスクを Workers AI で細分化します
                </List.Item>
                <List.Item fontSize="sm" color="fg.muted">
                  細分化結果を Google Calendar へ予定として追加します
                </List.Item>
                <List.Item fontSize="sm" color="fg.muted">
                  実行結果を D1 に保存し、画面へ反映します
                </List.Item>
              </List.Root>
              <Text fontSize="xs" color="fg.muted">
                Google Calendar
                の「予定作成」と「このアプリが作成したカレンダー管理」の権限を利用します。
              </Text>
            </Stack>
          </Box>
        ) : null}

        <HStack gap={3}>
          {signedInUser ? (
            <Button
              colorPalette="gray"
              variant="outline"
              onClick={handleSignOut}
              loading={isActionRunning}
            >
              ログアウト
            </Button>
          ) : (
            <Button
              colorPalette="teal"
              onClick={handleSignIn}
              loading={isActionRunning}
            >
              Google でログイン
            </Button>
          )}
        </HStack>

        {displayError ? (
          <Text fontSize="sm" color="red.500">
            {displayError}
          </Text>
        ) : null}

        <Text fontSize="xs" color="fg.muted">
          Google でログインすると、
          <Link asChild colorPalette="teal" textDecoration="underline">
            <NextLink href="/terms">利用規約</NextLink>
          </Link>
          と
          <Link asChild colorPalette="teal" textDecoration="underline">
            <NextLink href="/privacy">プライバシーポリシー</NextLink>
          </Link>
          に同意したものとみなします。
        </Text>
      </Stack>
    </Box>
  );
}
