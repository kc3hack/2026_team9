"use client";"use client";























































































































































































































































































































































}  );    </Box>      {children}    >      boxShadow="sm"      borderColor="gray.200"      borderWidth="1px"      p={5}      borderRadius="2xl"      bg="white"    <Box  return (function Card({ children }: { children: React.ReactNode }) {}  );    </Box>      </Container>        </Stack>          )}            </Text>              API取得に失敗しました。ログイン状態とバックエンド起動を確認してください。            <Text color="red.600" textAlign="center" fontSize="lg">          {state.status === "error" && (          </Card>            </Grid>              </Stack>                </Text>                  {weather?.reason ?? "天気情報なし"}                <Text fontSize="lg" color="gray.500">                <Text>{weather?.locationName ?? "-"}</Text>                <Text>降水量 {weather ? `${weather.precipitationMm} mm/h` : "--"}</Text>              <Stack gap={1} color="gray.600" fontSize="2xl">              </HStack>                </Stack>                  </Text>                    {weather?.umbrellaNeeded ? "傘あり" : "晴れ"}                  <Text fontSize="2xl" color="gray.600">                  </Text>                    {weather ? `${weather.precipitationProbability}%` : "--%"}                  <Text fontSize="5xl" fontWeight="semibold" color="gray.800">                <Stack gap={0}>                <Text fontSize="4xl">{weather?.umbrellaNeeded ? "☔" : "☀️"}</Text>              <HStack gap={3}>            >              alignItems="center"              gap={3}              templateColumns={{ base: "1fr", md: "1fr 1fr" }}            <Grid            </Text>              天気            <Text fontSize="2xl" color="gray.500" mb={3}>          <Card>          </Card>            </Stack>              )}                ))                  </HStack>                    </Stack>                      </Text>                        {event.location ?? "場所未設定"} / {eventDurationMinutes(event.start, event.end)}分                      <Text fontSize="2xl" color="gray.500">                      </Text>                        </Text>                          {event.summary}                        >                          ml={2}                          fontWeight="normal"                          fontSize="4xl"                          as="span"                        <Text                        {toJstHHmm(event.start)}                      <Text fontSize="4xl" fontWeight="semibold" color="gray.800">                    <Stack gap={1}>                    />                      bg="green.500"                      borderRadius="full"                      h="10px"                      w="10px"                      mt="6px"                    <Box                  <HStack key={event.id} align="start" gap={3}>                todayEvents.slice(0, 3).map((event) => (              ) : (                </Text>                  予定はありません                <Text color="gray.500" fontSize="lg">              {todayEvents.length === 0 ? (            <Stack gap={4}>            </Text>              今日の予定            <Text fontSize="2xl" color="gray.500" mb={3}>          <Card>          </Grid>            </Card>              </Box>                />                  bg={slack < 5 ? "red.400" : "green.500"}                  w={`${Math.min(100, Math.max(0, (Math.max(0, slack) / 60) * 100))}%`}                  borderRadius="full"                  h="full"                <Box              >                overflow="hidden"                borderRadius="full"                bg="gray.200"                h="8px"                mt={3}              <Box              </Text>                {departure}に出れば              <Text color="gray.600" fontSize="2xl" mt={1}>              </Text>                </Text>                  分                >                  fontWeight="normal"                  color="gray.500"                  fontSize="3xl"                  as="span"                <Text                {Math.max(0, slack)}              <Text fontSize="5xl" fontWeight="semibold" color="gray.800">              </Text>                余裕              <Text fontSize="2xl" color="gray.500" mb={2}>            <Card>            </Card>              </Text>                定刻通り              <Text mt={2} color="green.600" fontSize="xl">              </Text>                {transitSummary}              >                whiteSpace="nowrap"                textOverflow="ellipsis"                overflow="hidden"                mt={1}                fontWeight="semibold"                fontSize="2xl"                color="gray.700"              <Text              </Text>                </Text>                  分                >                  fontWeight="normal"                  color="gray.500"                  fontSize="3xl"                  as="span"                <Text                {transitMinutes}              <Text fontSize="5xl" fontWeight="semibold" color="gray.800">              </Text>                交通              <Text fontSize="2xl" color="gray.500" mb={2}>            <Card>          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>          </Stack>            </Text>              現在地: {currentLocation}            <Text color="gray.500" fontSize="xs">            </Text>              </Text>                {lateRisk}%              >                fontWeight="semibold"                color={lateRisk >= 60 ? "red.600" : "green.700"}                as="span"              <Text              遅刻リスク{" "}            <Text color="gray.600" fontSize="3xl">            </Text>              {departure}            >              lineHeight={1}              color="gray.800"              fontWeight="bold"              fontSize={{ base: "6xl", md: "8xl" }}            <Text            </Text>              出発まで            <Text color="gray.700" fontSize="2xl" letterSpacing="0.06em">          <Stack gap={1} textAlign="center" pt={2}>          </HStack>            </Button>              更新            >              onClick={() => setCurrentLocation(locationInput.trim() || "大阪駅")}              colorPalette="gray"              size="sm"            <Button            />              placeholder="現在地（例: 大阪駅）"              size="sm"              borderColor="gray.300"              bg="white"              maxW="240px"              onChange={(e) => setLocationInput(e.target.value)}              value={locationInput}            <Input          <HStack justify="center" gap={2}>        <Stack gap={6}>      <Container maxW="2xl">    <Box minH="100dvh" bg="#eeece8" py={{ base: 8, md: 14 }}>  return (  }, [state.data]);      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());      .filter((e) => !e.isAllDay)    return [...byId.values()]    }      byId.set(e.id, e);    for (const e of state.data?.eventsWithoutLocation ?? []) {    }      byId.set(b.event.id, b.event);    for (const b of state.data?.briefings ?? []) {    const byId = new Map<string, BriefingEvent>();  const todayEvents = useMemo(() => {  const weather = state.data?.weather ?? null;  const transitMinutes = urgent?.transitMinutes ?? 0;  const transitSummary = urgent?.route?.summary ?? "経路情報なし";  const slack = urgent?.slackMinutes ?? 0;  const lateRisk = urgent?.lateRiskPercent ?? 0;  const departure = urgent?.leaveBy ?? "--:--";  const urgent = state.data?.urgent ?? null;  }, [currentLocation]);    };      active = false;    return () => {      });        setState({ status: "error", data: null });        if (!active) return;      .catch(() => {      })        setState({ status: "ready", data: raw as MorningBriefingResult });        if (!active) return;      .then((raw) => {    fetchMorningBriefing(currentLocation, 30)    setState((prev) => ({ ...prev, status: "loading" }));    let active = true;  useEffect(() => {  const [currentLocation, setCurrentLocation] = useState("大阪駅");  const [locationInput, setLocationInput] = useState("大阪駅");  const [state, setState] = useState<State>({ status: "loading", data: null });export default function DashboardPage() {}  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;  const e = new Date(end);  const s = new Date(start);function eventDurationMinutes(start: string, end: string): number {}  return `${h}:${m}`;  const m = jst.getUTCMinutes().toString().padStart(2, "0");  const h = jst.getUTCHours().toString().padStart(2, "0");  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);  if (Number.isNaN(d.getTime())) return "--:--";  const d = new Date(iso);function toJstHHmm(iso: string): string {};  data: MorningBriefingResult | null;  status: "loading" | "ready" | "error";type State = {};  weather: WeatherInfo | null;  eventsWithoutLocation: BriefingEvent[];  urgent: EventBriefing | null;  briefings: EventBriefing[];  totalEvents: number;  now: string;  date: string;type MorningBriefingResult = {};  reason: string;  umbrellaNeeded: boolean;  precipitationMm: number;  precipitationProbability: number;  startIso: string;  locationName: string;type WeatherInfo = {};  lateRiskPercent: number;  slackMinutes: number;  wakeUpBy: string;  leaveBy: string;  transitMinutes: number;  route: TransitRoute | null;  destination: string;  event: BriefingEvent;type EventBriefing = {};  summary: string;  durationMinutes: number;  arrivalTime: string;  departureTime: string;type TransitRoute = {};  isAllDay: boolean;  end: string;  start: string;  location: string | null;  summary: string;  id: string;type BriefingEvent = {import { fetchMorningBriefing } from "@/lib/backend-api";import { useEffect, useMemo, useState } from "react";} from "@chakra-ui/react";  Text,  Stack,  Input,  HStack,  Grid,  Container,  Button,  Box,import {
import {
  Box,
  Button,
<<<<<<< HEAD
  Code,
=======
>>>>>>> ba45a79 (refactor(dashboard): replace getMorningDashboard with fetchMorningBriefing and update data structures)
  Container,
  Grid,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
<<<<<<< HEAD
import { useCallback, useEffect, useMemo, useState } from "react";
import { signInWithGoogle } from "@/lib/auth-api";
import {
  type CalendarTodayEvent,
  type CalendarTodayResponse,
  fetchCalendarToday,
} from "@/lib/backend-api";
import type { MorningDashboard } from "@/lib/morning-dashboard-api";
import { getMorningDashboard } from "@/lib/morning-dashboard-api";
=======
import { useEffect, useMemo, useState } from "react";
import { fetchMorningBriefing } from "@/lib/backend-api";
>>>>>>> ba45a79 (refactor(dashboard): replace getMorningDashboard with fetchMorningBriefing and update data structures)

type BriefingEvent = {
  id: string;
  summary: string;
  location: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
};

<<<<<<< HEAD
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
=======
type TransitRoute = {
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  summary: string;
};
>>>>>>> ba45a79 (refactor(dashboard): replace getMorningDashboard with fetchMorningBriefing and update data structures)

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
<<<<<<< HEAD
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setCalendarState((prev) => ({
        ...prev,
        status: "error",
        error: `Googleログイン開始に失敗しました: ${errorMessage}`,
      }));
    }
  }, []);
=======
  const [state, setState] = useState<State>({ status: "loading", data: null });
  const [locationInput, setLocationInput] = useState("大阪駅");
  const [currentLocation, setCurrentLocation] = useState("大阪駅");
>>>>>>> ba45a79 (refactor(dashboard): replace getMorningDashboard with fetchMorningBriefing and update data structures)

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

<<<<<<< HEAD
  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const routine = useMemo(() => {
    if (!state.data) {
      return [];
=======
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
>>>>>>> ba45a79 (refactor(dashboard): replace getMorningDashboard with fetchMorningBriefing and update data structures)
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
              onClick={() =>
                setCurrentLocation(locationInput.trim() || "大阪駅")
              }
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
<<<<<<< HEAD
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

            <WidgetCard
              title="Calendar API テスト"
              colSpan={{ base: 1, md: 6 }}
            >
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
=======
              {departure}
            </Text>
            <Text color="gray.600" fontSize="3xl">
              遅刻リスク{" "}
              <Text
                as="span"
                color={lateRisk >= 60 ? "red.600" : "green.700"}
                fontWeight="semibold"
>>>>>>> ba45a79 (refactor(dashboard): replace getMorningDashboard with fetchMorningBriefing and update data structures)
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
                      <Text
                        fontSize="4xl"
                        fontWeight="semibold"
                        color="gray.800"
                      >
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
                        {event.location ?? "場所未設定"} /{" "}
                        {eventDurationMinutes(event.start, event.end)}分
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
                <Text fontSize="4xl">
                  {weather?.umbrellaNeeded ? "☔" : "☀️"}
                </Text>
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
                <Text>
                  降水量 {weather ? `${weather.precipitationMm} mm/h` : "--"}
                </Text>
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
