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

const modeItems = [
  {
    title: "設計モード",
    subtitle: "夜に目標を行動へ変換",
    description:
      "大きな目標をサブタスクへ細分化し、期限と所要時間を付与してカレンダーまで反映します。",
    href: "/task-decomp",
    actionLabel: "タスクを分解する",
    badge: "Step 1",
    color: "teal",
  },
  {
    title: "運用モード",
    subtitle: "朝に現実へ再接続",
    description:
      "今日の予定と進捗を見ながら、次にやることを迷わず決められる状態へ整えます。",
    href: "/dashboard",
    actionLabel: "今日の実行を見る",
    badge: "Step 2",
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
          <Stack gap={4}>
            <HStack gap={3} flexWrap="wrap">
              <Badge colorPalette="teal" size="md">
                Execution OS
              </Badge>
              <Badge colorPalette="blue" size="md">
                Plan to Action
              </Badge>
            </HStack>
            <Heading size="2xl" lineHeight="1.1">
              計画と実行の断絶を埋める
            </Heading>
            <Text fontSize="lg" color="fg.muted" maxW="4xl">
              このプロダクトが解くのは「将来の目標を、今日の行動に変換し続けられない問題」です。
              必要なのは完璧な計画ではなく、状況が崩れても次の一歩が出る状態です。
            </Text>
          </Stack>

          <Card.Root
            bg="var(--app-surface)"
            borderColor="var(--app-border)"
            borderWidth="1px"
            borderRadius="2xl"
            className="flow-card"
          >
            <Card.Body>
              <Stack gap={3}>
                <Text fontWeight="semibold">共通課題</Text>
                <Text color="fg.muted">
                  タスクが多いこと自体ではなく、毎日の予定変化のたびに優先順位を再判断する認知負荷が大きいこと。
                </Text>
                <List.Root gap={1} ps={4}>
                  <List.Item color="fg.muted">
                    目標はあるが、今日やることに落ちない
                  </List.Item>
                  <List.Item color="fg.muted">
                    予定変更で計画が崩れると、再構築に時間を使う
                  </List.Item>
                  <List.Item color="fg.muted">
                    結果として着手が遅れ、継続しづらくなる
                  </List.Item>
                </List.Root>
              </Stack>
            </Card.Body>
          </Card.Root>

          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>
            {modeItems.map((item) => (
              <Card.Root
                key={item.href}
                bg="var(--app-surface)"
                borderColor="var(--app-border)"
                borderWidth="1px"
                borderRadius="2xl"
                className="flow-card"
              >
                <Card.Header pb={2}>
                  <Stack gap={2}>
                    <Badge
                      colorPalette={item.color}
                      variant="subtle"
                      w="fit-content"
                    >
                      {item.badge}
                    </Badge>
                    <Heading size="md">{item.title}</Heading>
                    <Text fontSize="sm" color="fg.muted">
                      {item.subtitle}
                    </Text>
                  </Stack>
                </Card.Header>
                <Card.Body pt={0}>
                  <Stack gap={4}>
                    <Text color="fg.muted">{item.description}</Text>
                    <Button asChild colorPalette={item.color} alignSelf="start">
                      <NextLink href={item.href}>{item.actionLabel}</NextLink>
                    </Button>
                  </Stack>
                </Card.Body>
              </Card.Root>
            ))}
          </Grid>

          <HStack gap={4} flexWrap="wrap">
            <Button asChild variant="outline" colorPalette="teal">
              <NextLink href="/task-decomp">設計モードへ</NextLink>
            </Button>
            <Button asChild variant="outline" colorPalette="blue">
              <NextLink href="/dashboard">運用モードへ</NextLink>
            </Button>
            <Text fontSize="sm" color="fg.muted">
              詳細な背景はリポジトリの README に整理しています。
            </Text>
          </HStack>
        </Stack>
      </Container>
    </Box>
  );
}
