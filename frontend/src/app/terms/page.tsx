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

export default function TermsPage() {
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
              利用規約
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
                本サービス（以下「本サービス」）は、ハッカソンで開発した Google
                カレンダー予定の細分化支援を目的とする試作版です。
              </Text>
              <List.Root gap={2}>
                <List.Item>
                  本サービスは、Google OAuth
                  によりログインし、予定の細分化・再登録のために利用します。
                </List.Item>
                <List.Item>
                  利用者は、自己の責任で本サービスを利用し、重要な予定の最終確認を行ってください。
                </List.Item>
                <List.Item>
                  本サービスは試作版のため、継続提供・完全な正確性・無停止を保証しません。
                </List.Item>
                <List.Item>
                  法令違反、不正アクセス、第三者への迷惑行為にあたる利用を禁止します。
                </List.Item>
                <List.Item>
                  本規約は、必要に応じて変更されることがあります。
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
