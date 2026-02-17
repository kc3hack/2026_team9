"use client";

import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "認証処理に失敗しました。";
}

export function AuthPanel() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionRunning, setIsActionRunning] = useState(false);

  const signedInUser = session?.user;

  const handleSignIn = async () => {
    setActionError(null);
    setIsActionRunning(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.href,
      });
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
      await authClient.signOut();
      await refetch();
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
      </Stack>
    </Box>
  );
}
