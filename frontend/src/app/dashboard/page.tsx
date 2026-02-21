"use client";

import {
  Badge,
  Box,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import type { MorningDashboard } from "@/lib/morning-dashboard-api";
import { getMorningDashboard } from "@/lib/morning-dashboard-api";

type LoadState = {
  status: "loading" | "ready" | "error";
  data: MorningDashboard | null;
};

function toClockString(baseTime: string, offsetMinutes: number): string {
  const [hourText, minuteText] = baseTime.split(":");
  const hours = Number(hourText ?? 0);
  const minutes = Number(minuteText ?? 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return baseTime;
  }

  const total = hours * 60 + minutes - offsetMinutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  const displayHours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const displayMinutes = (normalized % 60).toString().padStart(2, "0");
  return `${displayHours}:${displayMinutes}`;
}

export default function DashboardPage() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    data: null,
  });

  useEffect(() => {
    let active = true;

    getMorningDashboard()
      .then((data) => {
        if (!active) {
          return;
        }
        setState({ status: "ready", data });
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setState({ status: "error", data: null });
      });

    return () => {
      active = false;
    };
  }, []);

  const routine = useMemo(() => {
    if (!state.data) {
      return [];
    }
    return [...state.data.routine].sort(
      (a, b) => b.offsetMinutes - a.offsetMinutes,
    );
  }, [state.data]);

  return (
    <Box minH="100dvh" bg="gray.50">
      <Container maxW="6xl" px={{ base: 4, md: 8 }} py={{ base: 8, md: 10 }}>
        <Stack gap={6}>
          <Flex
            justify="space-between"
            align={{ base: "start", md: "center" }}
            direction={{ base: "column", md: "row" }}
            gap={3}
          >
            <Stack gap={1}>
              <HStack gap={2}>
                <Badge colorPalette="green" variant="subtle">
                  Morning OS
                </Badge>
                <Badge colorPalette="blue" variant="outline">
                  Widgets
                </Badge>
              </HStack>
              <Heading size="lg" color="gray.900">
                朝ダッシュボード
              </Heading>
              <Text color="gray.600" fontSize="sm">
                必要な情報だけをウィジェットで一覧化
              </Text>
            </Stack>
            <Badge
              colorPalette={state.status === "error" ? "red" : "green"}
              variant="subtle"
            >
              {state.status === "loading"
                ? "読み込み中"
                : state.status === "error"
                  ? "読み込み失敗"
                  : "同期済み"}
            </Badge>
          </Flex>

          <Grid templateColumns={{ base: "1fr", md: "repeat(6, 1fr)" }} gap={4}>
            <WidgetCard title="日付" colSpan={{ base: 1, md: 2 }}>
              <Heading size="md">{state.data?.date ?? "----/--/--"}</Heading>
              <Text fontSize="sm" color="gray.500">
                更新: {state.data?.updatedAt ?? "--"}
              </Text>
            </WidgetCard>

            <WidgetCard title="起床" colSpan={{ base: 1, md: 1 }}>
              <Heading size="md">{state.data?.wakeUpTime ?? "--:--"}</Heading>
            </WidgetCard>

            <WidgetCard title="出発" colSpan={{ base: 1, md: 1 }}>
              <Heading size="md">{state.data?.departTime ?? "--:--"}</Heading>
            </WidgetCard>

            <WidgetCard title="予定数" colSpan={{ base: 1, md: 2 }}>
              <Heading size="md">
                {state.data?.routine.length ?? 0} ステップ
              </Heading>
              <Text fontSize="sm" color="gray.500">
                逆算タイムラインを自動生成
              </Text>
            </WidgetCard>

            <WidgetCard
              title="最初の予定"
              colSpan={{ base: 1, md: 3 }}
              href="https://calendar.google.com"
            >
              <Text fontWeight="semibold" color="gray.900">
                {state.data?.earliestEvent?.title ?? "未登録"}
              </Text>
              <Text fontSize="sm" color="gray.500">
                {state.data?.earliestEvent?.startTime ?? "--:--"}
                {state.data?.earliestEvent?.location
                  ? ` ・ ${state.data.earliestEvent.location}`
                  : ""}
              </Text>
              <Text fontSize="xs" color="blue.600">
                タップしてカレンダーを開く
              </Text>
            </WidgetCard>

            <WidgetCard title="今日の変更" colSpan={{ base: 1, md: 3 }}>
              {state.data?.overrides?.length ? (
                <Stack gap={2}>
                  {state.data.overrides.map((override) => (
                    <Box
                      key={override.date}
                      p={3}
                      borderWidth="1px"
                      borderColor="gray.200"
                      borderRadius="xl"
                      bg="gray.50"
                    >
                      <Text fontSize="xs" color="gray.500">
                        {override.date}
                      </Text>
                      <Text fontSize="sm" fontWeight="semibold">
                        {override.note ?? "特記事項なし"}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Text fontSize="sm" color="gray.500">
                  今日は標準ルーティンです
                </Text>
              )}
            </WidgetCard>

            <WidgetCard title="アプリ起動" colSpan={{ base: 1, md: 6 }}>
              <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={3}>
                <Box
                  as="a"
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noreferrer"
                  borderWidth="1px"
                  borderColor="blue.100"
                  borderRadius="xl"
                  p={3}
                  bg="blue.50"
                  _hover={{ bg: "blue.100" }}
                >
                  <Text fontWeight="bold" color="blue.800">
                    カレンダー
                  </Text>
                  <Text fontSize="sm" color="blue.700">
                    予定を確認する
                  </Text>
                </Box>

                <Box
                  as="a"
                  href="https://www.google.com/maps"
                  target="_blank"
                  rel="noreferrer"
                  borderWidth="1px"
                  borderColor="green.100"
                  borderRadius="xl"
                  p={3}
                  bg="green.50"
                  _hover={{ bg: "green.100" }}
                >
                  <Text fontWeight="bold" color="green.800">
                    マップ
                  </Text>
                  <Text fontSize="sm" color="green.700">
                    経路を確認する
                  </Text>
                </Box>

                <Box
                  as="a"
                  href="https://www.google.com/search?q=天気"
                  target="_blank"
                  rel="noreferrer"
                  borderWidth="1px"
                  borderColor="orange.100"
                  borderRadius="xl"
                  p={3}
                  bg="orange.50"
                  _hover={{ bg: "orange.100" }}
                >
                  <Text fontWeight="bold" color="orange.800">
                    天気
                  </Text>
                  <Text fontSize="sm" color="orange.700">
                    雨予報を確認する
                  </Text>
                </Box>
              </Grid>
            </WidgetCard>

            <WidgetCard title="タイムライン" colSpan={{ base: 1, md: 6 }}>
              {routine.length === 0 ? (
                state.status === "error" ? (
                  <Text color="red.500">
                    タイムラインの取得に失敗しました。
                  </Text>
                ) : (
                  <Text color="gray.500">データを読み込んでいます。</Text>
                )
              ) : (
                <Grid
                  templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
                  gap={3}
                >
                  {routine.map((step) => (
                    <Flex
                      key={step.id}
                      justify="space-between"
                      align="center"
                      borderWidth="1px"
                      borderColor="gray.200"
                      borderRadius="xl"
                      px={3}
                      py={2}
                      bg="gray.50"
                    >
                      <HStack gap={2}>
                        <Badge
                          colorPalette={step.isOverride ? "yellow" : "green"}
                        >
                          {step.isOverride ? "変更" : "基本"}
                        </Badge>
                        <Text fontSize="sm" fontWeight="semibold">
                          {step.label}
                        </Text>
                      </HStack>
                      <Text fontWeight="bold">
                        {state.data
                          ? toClockString(
                              state.data.departTime,
                              step.offsetMinutes,
                            )
                          : "--:--"}
                      </Text>
                    </Flex>
                  ))}
                </Grid>
              )}
            </WidgetCard>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}

function WidgetCard({
  title,
  children,
  colSpan,
  href,
}: {
  title: string;
  children: React.ReactNode;
  colSpan: { base: number; md: number };
  href?: string;
}) {
  if (href) {
    return (
      <Box
        as="a"
        href={href}
        target="_blank"
        rel="noreferrer"
        gridColumn={{
          base: "auto",
          md: `span ${colSpan.md} / span ${colSpan.md}`,
        }}
        bg="white"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="2xl"
        p={4}
        minH="120px"
        boxShadow="sm"
        _hover={{ boxShadow: "md", transform: "translateY(-1px)" }}
        transition="all 0.15s ease"
      >
        <Stack gap={3} h="100%">
          <Text
            fontSize="xs"
            color="gray.500"
            textTransform="uppercase"
            letterSpacing="0.06em"
          >
            {title}
          </Text>
          <Box>{children}</Box>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      gridColumn={{
        base: "auto",
        md: `span ${colSpan.md} / span ${colSpan.md}`,
      }}
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="2xl"
      p={4}
      minH="120px"
      boxShadow="sm"
    >
      <Stack gap={3} h="100%">
        <Text
          fontSize="xs"
          color="gray.500"
          textTransform="uppercase"
          letterSpacing="0.06em"
        >
          {title}
        </Text>
        <Box>{children}</Box>
      </Stack>
    </Box>
  );
}
