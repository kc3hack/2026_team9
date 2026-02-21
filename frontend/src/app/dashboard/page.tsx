"use client";

import {
  Badge,
  Box,
  Button,
  Code,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signInWithGoogle } from "@/lib/auth-api";
import {
  fetchCalendarToday,
  type CalendarTodayEvent,
  type CalendarTodayResponse,
} from "@/lib/backend-api";
import type { MorningDashboard } from "@/lib/morning-dashboard-api";
import { getMorningDashboard } from "@/lib/morning-dashboard-api";

type LoadState = {
  status: "loading" | "ready" | "error";
  data: MorningDashboard | null;
};

type CalendarApiState = {
  status: "idle" | "loading" | "ready" | "error";
  data: CalendarTodayResponse | null;
  error: string | null;
  durationMs: number | null;
  fetchedAt: string | null;
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

function toCalendarStatusLabel(status: CalendarApiState["status"]): string {
  if (status === "loading") {
    return "取得中";
  }
  if (status === "ready") {
    return "取得成功";
  }
  if (status === "error") {
    return "取得失敗";
  }
  return "未取得";
}

function toCalendarStatusColor(status: CalendarApiState["status"]): string {
  if (status === "loading") {
    return "yellow";
  }
  if (status === "ready") {
    return "green";
  }
  if (status === "error") {
    return "red";
  }
  return "gray";
}

function formatApiEventTime(event: CalendarTodayEvent): string {
  if (event.isAllDay) {
    return "終日";
  }

  const parsed = new Date(event.start);
  if (Number.isNaN(parsed.getTime())) {
    return event.start || "--:--";
  }

  return parsed.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function nowTimeText(): string {
  return new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function DashboardPage() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    data: null,
  });
  const [calendarState, setCalendarState] = useState<CalendarApiState>({
    status: "idle",
    data: null,
    error: null,
    durationMs: null,
    fetchedAt: null,
  });

  const loadCalendar = useCallback(async () => {
    setCalendarState((prev) => ({
      ...prev,
      status: "loading",
      error: null,
    }));

    const startedAt = performance.now();
    try {
      const data = await fetchCalendarToday();
      setCalendarState({
        status: "ready",
        data,
        error: null,
        durationMs: Math.round(performance.now() - startedAt),
        fetchedAt: nowTimeText(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setCalendarState((prev) => ({
        ...prev,
        status: "error",
        error: errorMessage,
        durationMs: Math.round(performance.now() - startedAt),
        fetchedAt: nowTimeText(),
      }));
    }
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      await signInWithGoogle(window.location.href);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setCalendarState((prev) => ({
        ...prev,
        status: "error",
        error: `Googleログイン開始に失敗しました: ${errorMessage}`,
      }));
    }
  }, []);

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

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

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

            <WidgetCard title="Calendar API テスト" colSpan={{ base: 1, md: 6 }}>
              <Stack gap={3}>
                <Flex
                  justify="space-between"
                  align={{ base: "start", md: "center" }}
                  direction={{ base: "column", md: "row" }}
                  gap={2}
                >
                  <HStack gap={2} flexWrap="wrap">
                    <Badge
                      colorPalette={toCalendarStatusColor(calendarState.status)}
                      variant="subtle"
                    >
                      {toCalendarStatusLabel(calendarState.status)}
                    </Badge>
                    <Text fontSize="xs" color="gray.500">
                      {calendarState.fetchedAt
                        ? `最終取得: ${calendarState.fetchedAt}`
                        : "まだ取得していません"}
                      {calendarState.durationMs != null
                        ? ` ・ ${calendarState.durationMs}ms`
                        : ""}
                    </Text>
                  </HStack>

                  <HStack gap={2}>
                    <Button
                      size="sm"
                      colorPalette="teal"
                      onClick={() => void loadCalendar()}
                      loading={calendarState.status === "loading"}
                    >
                      予定を再取得
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleGoogleSignIn()}
                    >
                      Googleログイン
                    </Button>
                  </HStack>
                </Flex>

                {calendarState.error ? (
                  <Box bg="red.50" borderRadius="lg" p={3}>
                    <Text fontSize="sm" color="red.700" fontWeight="semibold">
                      {calendarState.error}
                    </Text>
                  </Box>
                ) : null}

                <HStack gap={4} flexWrap="wrap">
                  <Text fontSize="sm" color="gray.700">
                    対象日: {calendarState.data?.date ?? "--"}
                  </Text>
                  <Text fontSize="sm" color="gray.700">
                    予定件数: {calendarState.data?.events.length ?? 0} 件
                  </Text>
                  <Text fontSize="sm" color="gray.700">
                    先頭予定:{" "}
                    {calendarState.data?.earliestEvent
                      ? `${formatApiEventTime(calendarState.data.earliestEvent)} ${calendarState.data.earliestEvent.summary}`
                      : "なし"}
                  </Text>
                </HStack>

                {calendarState.data?.events.length ? (
                  <Stack gap={2}>
                    {calendarState.data.events.slice(0, 5).map((event) => (
                      <Flex
                        key={event.id}
                        justify="space-between"
                        align="center"
                        borderWidth="1px"
                        borderColor="gray.200"
                        borderRadius="xl"
                        px={3}
                        py={2}
                        bg="gray.50"
                      >
                        <Stack gap={0}>
                          <Text fontSize="sm" fontWeight="semibold">
                            {event.summary}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {formatApiEventTime(event)}
                            {event.location ? ` ・ ${event.location}` : ""}
                          </Text>
                        </Stack>
                        <Badge
                          variant="outline"
                          colorPalette={event.isAllDay ? "orange" : "blue"}
                        >
                          {event.isAllDay ? "終日" : "時刻あり"}
                        </Badge>
                      </Flex>
                    ))}
                    {calendarState.data.events.length > 5 ? (
                      <Text fontSize="xs" color="gray.500">
                        他 {calendarState.data.events.length - 5} 件
                      </Text>
                    ) : null}
                  </Stack>
                ) : (
                  <Text fontSize="sm" color="gray.500">
                    {calendarState.status === "loading"
                      ? "予定を取得しています..."
                      : "今日の予定はありません。"}
                  </Text>
                )}

                {calendarState.data ? (
                  <Box bg="gray.900" borderRadius="xl" p={3} overflowX="auto">
                    <Code
                      fontSize="xs"
                      whiteSpace="pre"
                      display="block"
                      color="green.100"
                      bg="transparent"
                    >
                      {JSON.stringify(calendarState.data, null, 2)}
                    </Code>
                  </Box>
                ) : null}
              </Stack>
            </WidgetCard>

            <WidgetCard title="アプリ起動" colSpan={{ base: 1, md: 6 }}>
              <Grid
                templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
                gap={3}
              >
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "none", display: "block" }}
                >
                  <Box
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
                </a>

                <a
                  href="https://www.google.com/maps"
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "none", display: "block" }}
                >
                  <Box
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
                </a>

                <a
                  href="https://www.google.com/search?q=天気"
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "none", display: "block" }}
                >
                  <Box
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
                </a>
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
        gridColumn={{
          base: "auto",
          md: `span ${colSpan.md} / span ${colSpan.md}`,
        }}
      >
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "none", display: "block" }}
        >
          <Box
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
        </a>
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
