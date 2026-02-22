"use client";

import {
  Box,
  Button,
  Container,
  Grid,
  GridItem,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { fetchMorningBriefing } from "@/lib/backend-api";
import {
  getTaskWorkflowHistory,
  type WorkflowRecord,
} from "@/lib/task-workflow-api";

type BriefingEvent = {
  id: string;
  summary: string;
  location: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
};

type TransitRoute = {
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  summary: string;
};

type EventBriefing = {
  event: BriefingEvent;
  destination: string;
  route: TransitRoute | null;
  transitMinutes: number;
  leaveBy: string;
  wakeUpBy: string;
  slackMinutes: number;
  lateRiskPercent: number;
};

type WeatherInfo = {
  locationName: string;
  startIso: string;
  precipitationProbability: number;
  precipitationMm: number;
  umbrellaNeeded: boolean;
  reason: string;
};

type MorningBriefingResult = {
  date: string;
  now: string;
  totalEvents: number;
  briefings: EventBriefing[];
  urgent: EventBriefing | null;
  eventsWithoutLocation: BriefingEvent[];
  weather: WeatherInfo | null;
};

type State = {
  status: "loading" | "ready" | "error";
  data: MorningBriefingResult | null;
  errorType?: "unauthorized" | "unknown";
};

type DecomposedTaskEvent = {
  key: string;
  taskInput: string;
  summary: string;
  subtaskTitle: string;
  startAt: string;
  endAt: string;
};

const TODAY_EVENTS_LIMIT = 3;
const DECOMPOSED_EVENTS_LIMIT = 3;

function truncateText(value: string, maxLength: number): string {
  if (maxLength <= 0) {
    return "";
  }
  if (value.length <= maxLength) {
    return value;
  }

  const safe = Math.max(1, Math.trunc(maxLength) - 1);
  return `${value.slice(0, safe).trimEnd()}…`;
}

function toJstHHmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const h = jst.getUTCHours().toString().padStart(2, "0");
  const m = jst.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function eventDurationMinutes(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
}

function collectUpcomingDecomposedEvents(
  records: WorkflowRecord[],
  limit: number,
): DecomposedTaskEvent[] {
  const now = Date.now();
  const flattened = records.flatMap((record) =>
    (record.calendarOutput?.createdEvents ?? []).map((eventItem) => ({
      key: `${record.workflowId}:${eventItem.id}`,
      taskInput: record.taskInput,
      summary: eventItem.summary,
      subtaskTitle: eventItem.subtaskTitle,
      startAt: eventItem.startAt,
      endAt: eventItem.endAt,
    })),
  );

  return flattened
    .filter((eventItem) => {
      const startAtMs = new Date(eventItem.startAt).getTime();
      return Number.isFinite(startAtMs) && startAtMs >= now;
    })
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    )
    .slice(0, Math.max(1, Math.trunc(limit)));
}

export default function DashboardPage() {
  const [state, setState] = useState<State>({
    status: "loading",
    data: null,
    errorType: undefined,
  });
  const [locationInput, setLocationInput] = useState("大阪駅");
  const [currentLocation, setCurrentLocation] = useState("大阪駅");
  const [forceRefresh, setForceRefresh] = useState(false);
  const [upcomingTaskEvents, setUpcomingTaskEvents] = useState<
    DecomposedTaskEvent[]
  >([]);
  const [taskEventsStatus, setTaskEventsStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, status: "loading", errorType: undefined }));
    setTaskEventsStatus("loading");

    Promise.allSettled([
      fetchMorningBriefing(currentLocation, 30, forceRefresh),
      getTaskWorkflowHistory(50),
    ])
      .then(([briefingResult, workflowResult]) => {
        if (!active) {
          return;
        }

        if (briefingResult.status === "fulfilled") {
          setState({
            status: "ready",
            data: briefingResult.value as MorningBriefingResult,
          });
        } else {
          const message =
            briefingResult.reason instanceof Error
              ? briefingResult.reason.message
              : "";
          const isUnauthorized =
            message.includes(" 401 ") || message.includes("401");
          setState({
            status: "error",
            data: null,
            errorType: isUnauthorized ? "unauthorized" : "unknown",
          });
        }

        if (workflowResult.status === "fulfilled") {
          setUpcomingTaskEvents(
            collectUpcomingDecomposedEvents(
              workflowResult.value.items,
              DECOMPOSED_EVENTS_LIMIT,
            ),
          );
          setTaskEventsStatus("ready");
        } else {
          setUpcomingTaskEvents([]);
          setTaskEventsStatus("error");
        }
      })
      .finally(() => {
        if (active) {
          setForceRefresh(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentLocation, forceRefresh]);

  const urgent = state.data?.urgent ?? null;
  const departure = urgent?.leaveBy ?? "--:--";
  const lateRisk = urgent?.lateRiskPercent ?? 0;
  const slack = urgent?.slackMinutes ?? 0;
  const transitSummary = urgent?.route?.summary ?? "経路情報なし";
  const transitMinutes = urgent?.transitMinutes ?? 0;
  const weather = state.data?.weather ?? null;

  const todayEvents = useMemo(() => {
    const byId = new Map<string, BriefingEvent>();

    for (const b of state.data?.briefings ?? []) {
      byId.set(b.event.id, b.event);
    }
    for (const e of state.data?.eventsWithoutLocation ?? []) {
      byId.set(e.id, e);
    }

    return [...byId.values()]
      .filter((e) => !e.isAllDay)
      .sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
      );
  }, [state.data]);

  const applyLocation = () => {
    const next = locationInput.trim() || "大阪駅";
    setLocationInput(next);
    setCurrentLocation(next);
    setForceRefresh(true);
  };

  return (
    <Box
      minH="100dvh"
      bg="var(--app-bg)"
      py={{ base: 5, md: 8 }}
      position="relative"
      overflow="hidden"
    >
      <Box className="app-orb app-orb--one" aria-hidden="true" />
      <Box className="app-orb app-orb--two" aria-hidden="true" />

      <Container
        maxW="full"
        px={{ base: 4, md: 6, xl: 10 }}
        position="relative"
        zIndex={1}
      >
        <Box w="full" maxW="1600px" mx="auto">
          <Stack gap={{ base: 4, md: 5 }}>
            <Card>
              <HStack
                justify="center"
                gap={2}
                flexWrap={{ base: "wrap", sm: "nowrap" }}
                align="stretch"
              >
                <Input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      applyLocation();
                    }
                  }}
                  flex="1"
                  minW={{ base: "0", sm: "220px" }}
                  bg="white"
                  borderColor="gray.300"
                  size="md"
                  placeholder="現在地（例: 大阪駅）"
                />
                <Button
                  size="md"
                  minW={{ base: "100%", sm: "84px" }}
                  colorPalette="gray"
                  onClick={applyLocation}
                >
                  更新
                </Button>
              </HStack>
              <Text color="gray.500" fontSize="xs" mt={2}>
                現在地: {currentLocation}
              </Text>
            </Card>

            <Grid
              templateColumns={{
                base: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
                xl: "repeat(12, minmax(0, 1fr))",
              }}
              gap={{ base: 4, md: 5 }}
              alignItems="stretch"
            >
              <GridItem colSpan={{ base: 1, md: 2, xl: 6 }}>
                <Card minH={{ base: "180px", md: "210px" }}>
                  <Stack h="full" justify="center" gap={1}>
                    <Text
                      color="gray.700"
                      fontSize={{ base: "sm", md: "md" }}
                      letterSpacing="0.08em"
                    >
                      出発まで
                    </Text>
                    <Text
                      fontSize={{ base: "5xl", md: "7xl" }}
                      fontWeight="bold"
                      color="gray.800"
                      lineHeight={1}
                    >
                      {departure}
                    </Text>
                    <HStack
                      gap={3}
                      flexWrap="wrap"
                      color="gray.600"
                      fontSize={{ base: "md", md: "lg" }}
                    >
                      <Text>
                        遅刻リスク{" "}
                        <Text
                          as="span"
                          color={lateRisk >= 60 ? "red.600" : "green.700"}
                          fontWeight="semibold"
                        >
                          {lateRisk}%
                        </Text>
                      </Text>
                      <Text>移動 {transitMinutes}分</Text>
                    </HStack>
                    <Text
                      color="gray.500"
                      fontSize={{ base: "sm", md: "md" }}
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      経路: {truncateText(transitSummary, 52)}
                    </Text>
                  </Stack>
                </Card>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 1, xl: 3 }}>
                <Card minH={{ base: "160px", md: "210px" }}>
                  <Text fontSize="md" color="gray.500" mb={1}>
                    交通
                  </Text>
                  <Text
                    fontSize={{ base: "3xl", md: "4xl" }}
                    fontWeight="semibold"
                    color="gray.800"
                  >
                    {transitMinutes}
                    <Text
                      as="span"
                      fontSize="xl"
                      color="gray.500"
                      fontWeight="normal"
                    >
                      分
                    </Text>
                  </Text>
                  <Text
                    color="gray.700"
                    fontSize={{ base: "md", md: "lg" }}
                    fontWeight="semibold"
                    mt={1}
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {truncateText(transitSummary, 22)}
                  </Text>
                </Card>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 1, xl: 3 }}>
                <Card minH={{ base: "160px", md: "210px" }}>
                  <Text fontSize="md" color="gray.500" mb={1}>
                    余裕
                  </Text>
                  <Text
                    fontSize={{ base: "3xl", md: "4xl" }}
                    fontWeight="semibold"
                    color="gray.800"
                  >
                    {Math.max(0, slack)}
                    <Text
                      as="span"
                      fontSize="xl"
                      color="gray.500"
                      fontWeight="normal"
                    >
                      分
                    </Text>
                  </Text>
                  <Text
                    color="gray.600"
                    fontSize={{ base: "md", md: "lg" }}
                    mt={1}
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {departure}に出れば
                  </Text>
                  <Box
                    mt={3}
                    h="8px"
                    bg="gray.200"
                    borderRadius="full"
                    overflow="hidden"
                  >
                    <Box
                      h="full"
                      borderRadius="full"
                      w={`${Math.min(100, Math.max(0, (Math.max(0, slack) / 60) * 100))}%`}
                      bg={slack < 5 ? "red.400" : "green.500"}
                    />
                  </Box>
                </Card>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 1, xl: 4 }}>
                <Card minH={{ base: "220px", md: "250px" }}>
                  <Text fontSize="md" color="gray.500" mb={2}>
                    今日の予定
                  </Text>
                  <Stack gap={3}>
                    {todayEvents.length === 0 ? (
                      <Text color="gray.500" fontSize="md">
                        予定はありません
                      </Text>
                    ) : (
                      todayEvents.slice(0, TODAY_EVENTS_LIMIT).map((event) => (
                        <HStack key={event.id} align="start" gap={3} w="full">
                          <Box
                            mt="6px"
                            w="10px"
                            h="10px"
                            borderRadius="full"
                            bg="green.500"
                            flexShrink={0}
                          />
                          <Stack gap={1} minW={0} flex="1">
                            <HStack gap={2}>
                              <Text
                                px={2}
                                py={0.5}
                                borderRadius="md"
                                bg="gray.100"
                                color="gray.700"
                                fontSize="sm"
                                fontWeight="semibold"
                                lineHeight={1.2}
                              >
                                {toJstHHmm(event.start)}
                              </Text>
                              <Text fontSize="sm" color="gray.500">
                                {eventDurationMinutes(event.start, event.end)}分
                              </Text>
                            </HStack>
                            <Text
                              fontSize={{ base: "lg", md: "xl" }}
                              fontWeight="semibold"
                              color="gray.800"
                              lineHeight={1.3}
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                            >
                              {truncateText(event.summary, 26)}
                            </Text>
                            <Text
                              fontSize={{ base: "sm", md: "md" }}
                              color="gray.500"
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                            >
                              {truncateText(event.location ?? "場所未設定", 24)}
                            </Text>
                          </Stack>
                        </HStack>
                      ))
                    )}
                  </Stack>
                </Card>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 1, xl: 4 }}>
                <Card minH={{ base: "220px", md: "250px" }}>
                  <Text fontSize="md" color="gray.500" mb={2}>
                    タスク細分化の予定
                  </Text>
                  <Stack gap={3}>
                    {taskEventsStatus === "loading" ? (
                      <Text color="gray.500" fontSize="md">
                        読み込み中...
                      </Text>
                    ) : upcomingTaskEvents.length === 0 ? (
                      <Text color="gray.500" fontSize="md">
                        直近の細分化予定はありません
                      </Text>
                    ) : (
                      upcomingTaskEvents.map((eventItem) => (
                        <HStack
                          key={eventItem.key}
                          align="start"
                          gap={3}
                          w="full"
                        >
                          <Box
                            mt="6px"
                            w="10px"
                            h="10px"
                            borderRadius="full"
                            bg="blue.500"
                            flexShrink={0}
                          />
                          <Stack gap={1} minW={0} flex="1">
                            <HStack gap={2}>
                              <Text
                                px={2}
                                py={0.5}
                                borderRadius="md"
                                bg="blue.50"
                                color="blue.700"
                                fontSize="sm"
                                fontWeight="semibold"
                                lineHeight={1.2}
                              >
                                {toJstHHmm(eventItem.startAt)}
                              </Text>
                              <Text fontSize="sm" color="gray.500">
                                {eventDurationMinutes(
                                  eventItem.startAt,
                                  eventItem.endAt,
                                )}
                                分
                              </Text>
                            </HStack>
                            <Text
                              fontSize={{ base: "lg", md: "xl" }}
                              fontWeight="semibold"
                              color="gray.800"
                              lineHeight={1.3}
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                            >
                              {truncateText(eventItem.subtaskTitle, 24)}
                            </Text>
                            <Text
                              fontSize={{ base: "sm", md: "md" }}
                              color="gray.500"
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                            >
                              {truncateText(eventItem.summary, 34)}
                            </Text>
                            <Text
                              fontSize={{ base: "sm", md: "md" }}
                              color="gray.500"
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                            >
                              元タスク: {truncateText(eventItem.taskInput, 18)}
                            </Text>
                          </Stack>
                        </HStack>
                      ))
                    )}
                    {taskEventsStatus === "error" && (
                      <Text color="orange.600" fontSize="sm">
                        細分化予定の取得に失敗しました。
                      </Text>
                    )}
                  </Stack>
                </Card>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 2, xl: 4 }}>
                <Card minH={{ base: "180px", md: "250px" }}>
                  <Text fontSize="md" color="gray.500" mb={2}>
                    天気
                  </Text>
                  <Grid
                    templateColumns={{ base: "1fr", sm: "1fr 1fr" }}
                    gap={3}
                    alignItems="center"
                  >
                    <HStack gap={3}>
                      <Text fontSize="3xl">
                        {weather?.umbrellaNeeded ? "☔" : "☀️"}
                      </Text>
                      <Stack gap={0}>
                        <Text
                          fontSize={{ base: "3xl", md: "4xl" }}
                          fontWeight="semibold"
                          color="gray.800"
                        >
                          {weather
                            ? `${weather.precipitationProbability}%`
                            : "--%"}
                        </Text>
                        <Text
                          fontSize={{ base: "md", md: "lg" }}
                          color="gray.600"
                        >
                          {weather?.umbrellaNeeded ? "傘あり" : "晴れ"}
                        </Text>
                      </Stack>
                    </HStack>

                    <Stack
                      gap={1}
                      color="gray.600"
                      fontSize={{ base: "md", md: "lg" }}
                      minW={0}
                    >
                      <Text>
                        降水量{" "}
                        {weather ? `${weather.precipitationMm} mm/h` : "--"}
                      </Text>
                      <Text
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                      >
                        {weather?.locationName ?? "-"}
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        {weather?.reason ?? "天気情報なし"}
                      </Text>
                    </Stack>
                  </Grid>
                </Card>
              </GridItem>
            </Grid>

            {state.status === "error" && (
              <Card>
                <Stack align="center" gap={2}>
                  <Text color="red.600" textAlign="center" fontSize="md">
                    {state.errorType === "unauthorized"
                      ? "ログインが必要です。"
                      : "API取得に失敗しました。ログイン状態とバックエンド起動を確認してください。"}
                  </Text>
                  {state.errorType === "unauthorized" && (
                    <Button
                      size="sm"
                      colorPalette="blue"
                      onClick={() => {
                        window.location.assign("/");
                      }}
                    >
                      ログイン画面へ
                    </Button>
                  )}
                </Stack>
              </Card>
            )}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}

function Card({
  children,
  minH,
}: {
  children: React.ReactNode;
  minH?: string | { base: string; md: string };
}) {
  return (
    <Box
      bg="white"
      borderRadius="2xl"
      p={{ base: 4, md: 5 }}
      minH={minH}
      h="full"
      borderWidth="1px"
      borderColor="gray.200"
      boxShadow="sm"
      overflow="hidden"
    >
      {children}
    </Box>
  );
}
