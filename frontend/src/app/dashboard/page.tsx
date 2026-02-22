"use client";

import {
  Box,
  Button,
  Container,
  Grid,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { fetchMorningBriefing } from "@/lib/backend-api";

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

export default function DashboardPage() {
  const [state, setState] = useState<State>({
    status: "loading",
    data: null,
    errorType: undefined,
  });
  const [locationInput, setLocationInput] = useState("大阪駅");
  const [currentLocation, setCurrentLocation] = useState("大阪駅");
  const [forceRefresh, setForceRefresh] = useState(false);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, status: "loading", errorType: undefined }));

    fetchMorningBriefing(currentLocation, 30, forceRefresh)
      .then((raw) => {
        if (!active) return;
        setState({ status: "ready", data: raw as MorningBriefingResult });
        setForceRefresh(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "";
        const isUnauthorized = message.includes(" 401 ") || message.includes("401");
        setState({
          status: "error",
          data: null,
          errorType: isUnauthorized ? "unauthorized" : "unknown",
        });
        setForceRefresh(false);
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
    <Box minH="100dvh" bg="#eeece8" py={{ base: 8, md: 12 }}>
      <Container maxW="2xl">
        <Stack gap={5}>
          <HStack
            justify="center"
            gap={2}
            bg="white"
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="xl"
            p={2}
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
              minW={{ base: "140px", md: "240px" }}
              bg="white"
              borderColor="gray.300"
              size="md"
              placeholder="現在地（例: 大阪駅）"
            />
            <Button
              size="md"
              minW="84px"
              colorPalette="gray"
              onClick={applyLocation}
            >
              更新
            </Button>
          </HStack>

          <Stack gap={1} textAlign="center" pt={1}>
            <Text
              color="gray.700"
              fontSize={{ base: "md", md: "lg" }}
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
            <Text color="gray.600" fontSize={{ base: "lg", md: "xl" }}>
              遅刻リスク{" "}
              <Text
                as="span"
                color={lateRisk >= 60 ? "red.600" : "green.700"}
                fontWeight="semibold"
              >
                {lateRisk}%
              </Text>
            </Text>
            <Text color="gray.500" fontSize="xs">
              現在地: {currentLocation}
            </Text>
          </Stack>

          <Grid
            templateColumns={{ base: "1fr", md: "1fr 1fr" }}
            gap={4}
            alignItems="stretch"
          >
            <Card minH={{ base: "160px", md: "180px" }}>
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
                fontSize={{ base: "lg", md: "xl" }}
                fontWeight="semibold"
                mt={1}
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                {transitSummary}
              </Text>
              <Text mt={1} color="green.600" fontSize="md">
                定刻通り
              </Text>
            </Card>

            <Card minH={{ base: "160px", md: "180px" }}>
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
              <Text color="gray.600" fontSize={{ base: "md", md: "lg" }} mt={1}>
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
          </Grid>

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
                todayEvents.slice(0, 3).map((event) => (
                  <HStack key={event.id} align="start" gap={3}>
                    <Box
                      mt="6px"
                      w="10px"
                      h="10px"
                      borderRadius="full"
                      bg="green.500"
                    />
                    <Stack gap={1}>
                      <Text
                        fontSize={{ base: "2xl", md: "3xl" }}
                        fontWeight="semibold"
                        color="gray.800"
                      >
                        {toJstHHmm(event.start)}
                        <Text
                          as="span"
                          fontSize={{ base: "2xl", md: "3xl" }}
                          fontWeight="normal"
                          ml={2}
                        >
                          {event.summary}
                        </Text>
                      </Text>
                      <Text
                        fontSize={{ base: "md", md: "lg" }}
                        color="gray.500"
                      >
                        {event.location ?? "場所未設定"} /{" "}
                        {eventDurationMinutes(event.start, event.end)}分
                      </Text>
                    </Stack>
                  </HStack>
                ))
              )}
            </Stack>
          </Card>

          <Card minH={{ base: "180px", md: "210px" }}>
            <Text fontSize="md" color="gray.500" mb={2}>
              天気
            </Text>
            <Grid
              templateColumns={{ base: "1fr", md: "1fr 1fr" }}
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
                    {weather ? `${weather.precipitationProbability}%` : "--%"}
                  </Text>
                  <Text fontSize={{ base: "md", md: "lg" }} color="gray.600">
                    {weather?.umbrellaNeeded ? "傘あり" : "晴れ"}
                  </Text>
                </Stack>
              </HStack>

              <Stack
                gap={1}
                color="gray.600"
                fontSize={{ base: "md", md: "lg" }}
              >
                <Text>
                  降水量 {weather ? `${weather.precipitationMm} mm/h` : "--"}
                </Text>
                <Text>{weather?.locationName ?? "-"}</Text>
                <Text fontSize="sm" color="gray.500">
                  {weather?.reason ?? "天気情報なし"}
                </Text>
              </Stack>
            </Grid>
          </Card>

          {state.status === "error" && (
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
          )}
        </Stack>
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
      borderWidth="1px"
      borderColor="gray.200"
      boxShadow="sm"
    >
      {children}
    </Box>
  );
}
