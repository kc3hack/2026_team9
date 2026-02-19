"use client";

import {
  Badge,
  Box,
  Button,
  HStack,
  Link,
  Stack,
  Text,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSession,
  type SessionResponse,
  signInWithGoogle,
  signOut,
} from "@/lib/auth-api";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "認証処理に失敗しました。";
}

export function AuthPanel() {
  const [session, setSession] = useState<SessionResponse>(null);
  const [isPending, setIsPending] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionRunning, setIsActionRunning] = useState(false);

  const signedInUser = useMemo(() => session?.user ?? null, [session]);

  const refreshSession = useCallback(async () => {
    setIsPending(true);
    try {
      const nextSession = await getSession();
      setSession(nextSession);
    } catch (error) {
      setActionError(toErrorMessage(error));
      setSession(null);
    } finally {
      setIsPending(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const handleSignIn = async () => {
    setActionError(null);
    setIsActionRunning(true);
    try {
      await signInWithGoogle(window.location.href);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setIsActionRunning(false);
    }
  };

  const handleSignOut = async () => {
    setActionError(null);
    setIsActionRunning(true);
    try {
      await signOut();
      await refreshSession();
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setIsActionRunning(false);
    }
  };

  return (
    <Box bg="white" borderWidth="1px" borderRadius="2xl" p={{ base: 5, md: 7 }}>
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

        {actionError ? (
          <Text fontSize="sm" color="red.500">
            {actionError}
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
