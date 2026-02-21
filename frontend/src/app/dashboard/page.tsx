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
  const [state, setState] = useState<State>({ status: "loading", data: null });
  const [locationInput, setLocationInput] = useState("大阪駅");
  const [currentLocation, setCurrentLocation] = useState("大阪駅");

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, status: "loading" }));

    fetchMorningBriefing(currentLocation, 30)
      .then((raw) => {
        if (!active) return;
        setState({ status: "ready", data: raw as MorningBriefingResult });
      })
      .catch(() => {
        if (!active) return;
        setState({ status: "error", data: null });
      });

    return () => {
      active = false;
    };
  }, [currentLocation]);

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
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [state.data]);

  return (
    <Box minH="100dvh" bg="#eeece8" py={{ base: 8, md: 14 }}>
      <Container maxW="2xl">
        <Stack gap={6}>
          <HStack justify="center" gap={2}>
            <Input
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              maxW="240px"
              bg="white"
              borderColor="gray.300"
              size="sm"
              placeholder="現在地（例: 大阪駅）"
            />
            <Button
              size="sm"
              colorPalette="gray"
              onClick={() => setCurrentLocation(locationInput.trim() || "大阪駅")}
            >
              更新
            </Button>
          </HStack>

          <Stack gap={1} textAlign="center" pt={2}>
            <Text color="gray.700" fontSize="2xl" letterSpacing="0.06em">
              出発まで
            </Text>
            <Text
              fontSize={{ base: "6xl", md: "8xl" }}
              fontWeight="bold"
              color="gray.800"
              lineHeight={1}
            >
              {departure}
            </Text>
            <Text color="gray.600" fontSize="3xl">
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

          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
            <Card>
              <Text fontSize="2xl" color="gray.500" mb={2}>
                交通
              </Text>
              <Text fontSize="5xl" fontWeight="semibold" color="gray.800">
                {transitMinutes}
                <Text
                  as="span"
                  fontSize="3xl"
                  color="gray.500"
                  fontWeight="normal"
                >
                  分
                </Text>
              </Text>
              <Text
                color="gray.700"
                fontSize="2xl"
                fontWeight="semibold"
                mt={1}
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                {transitSummary}
              </Text>
              <Text mt={2} color="green.600" fontSize="xl">
                定刻通り
              </Text>
            </Card>

            <Card>
              <Text fontSize="2xl" color="gray.500" mb={2}>
                余裕
              </Text>
              <Text fontSize="5xl" fontWeight="semibold" color="gray.800">
                {Math.max(0, slack)}
                <Text
                  as="span"
                  fontSize="3xl"
                  color="gray.500"
                  fontWeight="normal"
                >
                  分
                </Text>
              </Text>
              <Text color="gray.600" fontSize="2xl" mt={1}>
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

          <Card>
            <Text fontSize="2xl" color="gray.500" mb={3}>
              今日の予定
            </Text>
            <Stack gap={4}>
              {todayEvents.length === 0 ? (
                <Text color="gray.500" fontSize="lg">
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
                      <Text fontSize="4xl" fontWeight="semibold" color="gray.800">
                        {toJstHHmm(event.start)}
                        <Text
                          as="span"
                          fontSize="4xl"
                          fontWeight="normal"
                          ml={2}
                        >
                          {event.summary}
                        </Text>
                      </Text>
                      <Text fontSize="2xl" color="gray.500">
                        {event.location ?? "場所未設定"} / {eventDurationMinutes(event.start, event.end)}分
                      </Text>
                    </Stack>
                  </HStack>
                ))
              )}
            </Stack>
          </Card>

          <Card>
            <Text fontSize="2xl" color="gray.500" mb={3}>
              天気
            </Text>
            <Grid
              templateColumns={{ base: "1fr", md: "1fr 1fr" }}
              gap={3}
              alignItems="center"
            >
              <HStack gap={3}>
                <Text fontSize="4xl">{weather?.umbrellaNeeded ? "☔" : "☀️"}</Text>
                <Stack gap={0}>
                  <Text fontSize="5xl" fontWeight="semibold" color="gray.800">
                    {weather ? `${weather.precipitationProbability}%` : "--%"}
                  </Text>
                  <Text fontSize="2xl" color="gray.600">
                    {weather?.umbrellaNeeded ? "傘あり" : "晴れ"}
                  </Text>
                </Stack>
              </HStack>

              <Stack gap={1} color="gray.600" fontSize="2xl">
                <Text>降水量 {weather ? `${weather.precipitationMm} mm/h` : "--"}</Text>
                <Text>{weather?.locationName ?? "-"}</Text>
                <Text fontSize="lg" color="gray.500">
                  {weather?.reason ?? "天気情報なし"}
                </Text>
              </Stack>
            </Grid>
          </Card>

          {state.status === "error" && (
            <Text color="red.600" textAlign="center" fontSize="lg">
              API取得に失敗しました。ログイン状態とバックエンド起動を確認してください。
            </Text>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <Box
      bg="white"
      borderRadius="2xl"
      p={5}
      borderWidth="1px"
      borderColor="gray.200"
      boxShadow="sm"
    >
      {children}
    </Box>
  );
}
