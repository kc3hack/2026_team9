import {
  Box,
  Button,
  Container,
  Heading,
  List,
  Stack,
  Text,
} from "@chakra-ui/react";
import NextLink from "next/link";

const LAST_UPDATED = "2026年2月19日";

export default function PrivacyPage() {
  return (
    <Box
      minH="100dvh"
      bgGradient="linear(to-b, teal.50, cyan.50)"
      px={{ base: 4, md: 8 }}
      py={{ base: 8, md: 12 }}
    >
      <Container maxW="3xl">
        <Stack gap={6}>
          <Stack gap={2}>
            <Heading size="2xl" lineHeight="1.15">
              プライバシーポリシー
            </Heading>
            <Text fontSize="sm" color="fg.muted">
              最終更新日: {LAST_UPDATED}
            </Text>
          </Stack>

          <Box
            bg="white"
            borderWidth="1px"
            borderRadius="2xl"
            p={{ base: 5, md: 7 }}
          >
            <Stack gap={4}>
              <Text>
                本サービスは、ハッカソンで開発した Google
                カレンダー予定の細分化支援のために、以下の情報を取り扱います。
              </Text>
              <List.Root gap={2}>
                <List.Item>
                  取得情報: Google
                  アカウントの基本情報（名前・メールアドレス）および Google
                  カレンダー連携に必要な認証情報。
                </List.Item>
                <List.Item>
                  利用目的:
                  ログイン認証、ユーザー識別、カレンダー予定の細分化と登録・更新。
                </List.Item>
                <List.Item>
                  第三者提供:
                  法令に基づく場合を除き、本人同意なく第三者へ提供しません。
                </List.Item>
                <List.Item>
                  保存期間: 必要最小限の期間のみ保持し、利用者は Google
                  アカウント設定から連携解除できます。
                </List.Item>
                <List.Item>
                  本ポリシーは、機能追加や法令変更に応じて改定されることがあります。
                </List.Item>
              </List.Root>
            </Stack>
          </Box>

          <Button
            asChild
            variant="outline"
            colorPalette="teal"
            w={{ base: "full", sm: "auto" }}
          >
            <NextLink href="/">トップへ戻る</NextLink>
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
