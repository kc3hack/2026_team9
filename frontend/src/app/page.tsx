"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Grid,
  Heading,
  HStack,
  List,
  Stack,
  Text,
} from "@chakra-ui/react";
import NextLink from "next/link";

const flowItems = [
  {
    title: "予定とタスクをまとめる",
    subtitle: "大きなタスクを、実行できる単位へ",
    description:
      "数日かかるタスクもサブタスクに分け、期限と所要時間を付けて着手しやすい形にします。",
    href: "/task-decomp",
    actionLabel: "タスクを細分化する",
    badge: "タスク",
    color: "teal",
  },
  {
    title: "朝に必要な情報を確認",
    subtitle: "予定・移動・天気を一画面に集約",
    description:
      "今日の予定と移動時間、天気をまとめて確認し、迷わず次の一歩を決められる状態にします。",
    href: "/dashboard",
    actionLabel: "朝の確認をする",
    badge: "朝",
    color: "blue",
  },
] as const;

export default function HomePage() {
  return (
    <Box
      minH="100dvh"
      bg="var(--app-bg)"
      px={{ base: 4, md: 8 }}
      py={{ base: 8, md: 12 }}
      position="relative"
      overflow="hidden"
    >
      <Box className="app-orb app-orb--one" aria-hidden="true" />
      <Box className="app-orb app-orb--two" aria-hidden="true" />

      <Container maxW="6xl" position="relative" zIndex={1}>
        <Stack gap={{ base: 7, md: 10 }}>
          <Stack gap={{ base: 5, md: 6 }}>
            <Text
              as="p"
              fontSize={{ base: "sm", md: "md" }}
              fontWeight="bold"
              letterSpacing="0.08em"
              color="teal.700"
            >
              <Box as="ruby">
                ネボガード
                <Box as="rt" fontSize="0.52em" letterSpacing="0.06em">
                  NeboGuard
                </Box>
              </Box>
            </Text>
            <Heading
              as="h1"
              fontSize={{ base: "3xl", md: "5xl", lg: "6xl" }}
              lineHeight={{ base: "1.2", md: "1.1" }}
              letterSpacing="-0.02em"
              maxW="5xl"
            >
              朝の判断を、1画面で。
            </Heading>
            <Text
              fontSize={{ base: "md", md: "xl" }}
              lineHeight="1.8"
              color="fg.muted"
              maxW="4xl"
            >
              予定・移動・天気をまとめて、出発の判断を一文で提示します。情報を探し回らず、
              そのまま行動に移れる朝をつくるためのアプリです。
            </Text>
            <HStack gap={3} flexWrap="wrap">
              <Button
                asChild
                colorPalette="blue"
                size="lg"
                fontWeight="semibold"
              >
                <NextLink href="/dashboard">今日の朝情報を見る</NextLink>
              </Button>
              <Button asChild variant="outline" size="lg" fontWeight="semibold">
                <NextLink href="/task-decomp">タスクを細分化する</NextLink>
              </Button>
            </HStack>
          </Stack>

          <Card.Root
            bg="var(--app-surface)"
            borderColor="var(--app-border)"
            borderWidth="1px"
            borderRadius="2xl"
            className="flow-card"
          >
            <Card.Body>
              <Stack gap={4}>
                <Heading
                  as="h2"
                  fontSize={{ base: "xl", md: "2xl" }}
                  lineHeight="1.3"
                >
                  このアプリで減らせる迷い
                </Heading>
                <Text
                  fontSize={{ base: "md", md: "lg" }}
                  lineHeight="1.8"
                  color="fg.muted"
                >
                  朝に必要な情報は多くありません。出発時刻、天気、移動の乱れを素早く判断できる状態を目指します。
                </Text>
                <List.Root gap={2} ps={5}>
                  <List.Item
                    color="fg.muted"
                    fontSize={{ base: "sm", md: "md" }}
                    lineHeight="1.7"
                  >
                    予定ごとの出発時刻をその場で計算しなくてよい
                  </List.Item>
                  <List.Item
                    color="fg.muted"
                    fontSize={{ base: "sm", md: "md" }}
                    lineHeight="1.7"
                  >
                    複数アプリを開いて情報を照合しなくてよい
                  </List.Item>
                  <List.Item
                    color="fg.muted"
                    fontSize={{ base: "sm", md: "md" }}
                    lineHeight="1.7"
                  >
                    「今すぐ何をすべきか」を一文で確認できる
                  </List.Item>
                </List.Root>
              </Stack>
            </Card.Body>
          </Card.Root>

          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>
            {flowItems.map((item) => (
              <Card.Root
                key={item.href}
                bg="var(--app-surface)"
                borderColor="var(--app-border)"
                borderWidth="1px"
                borderRadius="2xl"
                className="flow-card"
              >
                <Card.Header pb={3}>
                  <Stack gap={3}>
                    <Badge
                      colorPalette={item.color}
                      variant="subtle"
                      w="fit-content"
                    >
                      {item.badge}
                    </Badge>
                    <Heading
                      as="h3"
                      fontSize={{ base: "xl", md: "2xl" }}
                      lineHeight="1.25"
                    >
                      {item.title}
                    </Heading>
                    <Text fontSize={{ base: "sm", md: "md" }} color="fg.muted">
                      {item.subtitle}
                    </Text>
                  </Stack>
                </Card.Header>
                <Card.Body pt={0}>
                  <Stack gap={5}>
                    <Text
                      fontSize={{ base: "md", md: "lg" }}
                      lineHeight="1.8"
                      color="fg.muted"
                    >
                      {item.description}
                    </Text>
                    <Button
                      asChild
                      colorPalette={item.color}
                      size="lg"
                      fontWeight="semibold"
                      alignSelf="start"
                    >
                      <NextLink href={item.href}>{item.actionLabel}</NextLink>
                    </Button>
                  </Stack>
                </Card.Body>
              </Card.Root>
            ))}
          </Grid>

          <Box as="footer" pt={{ base: 2, md: 4 }}>
            <HStack
              justify="center"
              gap={3}
              flexWrap="wrap"
              fontSize={{ base: "sm", md: "md" }}
              color="fg.muted"
            >
              <NextLink
                href="/terms"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                利用規約
              </NextLink>
              <Text color="gray.400">/</Text>
              <NextLink
                href="/privacy"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                プライバシーポリシー
              </NextLink>
            </HStack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
