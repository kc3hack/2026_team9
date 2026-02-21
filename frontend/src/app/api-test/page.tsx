"use client";

import {
  Badge,
  Box,
  Button,
  Code,
  Container,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useState } from "react";
import { getSession, signInWithGoogle } from "@/lib/auth-api";
import {
  fetchCalendarToday,
  fetchMorningBriefing,
  fetchTransitDirections,
} from "@/lib/backend-api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TestId =
  | "session"
  | "calendar"
  | "transit"
  | "weather"
  | "briefing";

type TestResult = {
  status: "idle" | "running" | "ok" | "error";
  data?: unknown;
  error?: string;
  ms?: number;
};

const initialResults: Record<TestId, TestResult> = {
  session: { status: "idle" },
  calendar: { status: "idle" },
  transit: { status: "idle" },
  weather: { status: "idle" },
  briefing: { status: "idle" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ApiTestPage() {
  const [results, setResults] = useState(initialResults);
  const [origin, setOrigin] = useState("大阪駅");
  const [destination, setDestination] = useState("京都駅");
  const [briefingLocation, setBriefingLocation] = useState("大阪駅");

  const run = useCallback(
    async (id: TestId, fn: () => Promise<unknown>) => {
      setResults((prev) => ({
        ...prev,
        [id]: { status: "running" as const },
      }));
      const t0 = performance.now();
      try {
        const data = await fn();
        const ms = Math.round(performance.now() - t0);
        setResults((prev) => ({
          ...prev,
          [id]: { status: "ok" as const, data, ms },
        }));
      } catch (e: unknown) {
        const ms = Math.round(performance.now() - t0);
        const error = e instanceof Error ? e.message : String(e);
        setResults((prev) => ({
          ...prev,
          [id]: { status: "error" as const, error, ms },
        }));
      }
    },
    [],
  );

  const statusColor = (s: TestResult["status"]) => {
    if (s === "ok") return "green";
    if (s === "error") return "red";
    if (s === "running") return "yellow";
    return "gray";
  };

  return (
    <Box minH="100dvh" bg="gray.50" py={8}>
      <Container maxW="3xl">
        <Stack gap={6}>
          <Stack gap={2}>
            <Heading size="xl">API 接続テスト</Heading>
            <Text color="gray.600" fontSize="sm">
              各APIを個別にテストして接続状態を確認できます。
              ログインしてからテストしてください。
            </Text>
          </Stack>

          {/* ---------------------------------------------------------- */}
          {/* 1. Session */}
          {/* ---------------------------------------------------------- */}
          <TestCard
            title="1. セッション確認"
            description="Googleログイン済みか確認します"
            result={results.session}
            statusColor={statusColor}
          >
            <HStack gap={3}>
              <Button
                size="sm"
                colorPalette="blue"
                onClick={() => run("session", () => getSession())}
                disabled={results.session.status === "running"}
              >
                セッション取得
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => signInWithGoogle(window.location.href)}
              >
                Googleログイン
              </Button>
            </HStack>
          </TestCard>

          {/* ---------------------------------------------------------- */}
          {/* 2. Calendar */}
          {/* ---------------------------------------------------------- */}
          <TestCard
            title="2. Google Calendar"
            description="今日の予定を取得（要ログイン + GCPでCalendar API有効化）"
            result={results.calendar}
            statusColor={statusColor}
          >
            <Button
              size="sm"
              colorPalette="teal"
              onClick={() => run("calendar", () => fetchCalendarToday())}
              disabled={results.calendar.status === "running"}
            >
              今日の予定を取得
            </Button>
          </TestCard>

          {/* ---------------------------------------------------------- */}
          {/* 3. Transit (Routes API) */}
          {/* ---------------------------------------------------------- */}
          <TestCard
            title="3. 乗換検索（Routes API）"
            description="Google Routes API で経路検索（要 GOOGLE_MAPS_API_KEY）"
            result={results.transit}
            statusColor={statusColor}
          >
            <HStack gap={2} flexWrap="wrap">
              <Input
                size="sm"
                w="140px"
                placeholder="出発地"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
              <Text fontSize="sm">→</Text>
              <Input
                size="sm"
                w="140px"
                placeholder="目的地"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
              <Button
                size="sm"
                colorPalette="purple"
                onClick={() =>
                  run("transit", () =>
                    fetchTransitDirections(origin, destination),
                  )
                }
                disabled={results.transit.status === "running"}
              >
                検索
              </Button>
            </HStack>
          </TestCard>

          {/* ---------------------------------------------------------- */}
          {/* 4. Weather (Open-Meteo) */}
          {/* ---------------------------------------------------------- */}
          <TestCard
            title="4. 天気（Open-Meteo）"
            description="朝ブリーフィングの weather フィールドで確認（APIキー不要）"
            result={results.weather}
            statusColor={statusColor}
          >
            <Text fontSize="xs" color="gray.500">
              ※ 天気は朝ブリーフィング内で取得されます。下の「5. 朝ブリーフィング」で確認してください。
            </Text>
          </TestCard>

          {/* ---------------------------------------------------------- */}
          {/* 5. Morning Briefing (All combined) */}
          {/* ---------------------------------------------------------- */}
          <TestCard
            title="5. 朝ブリーフィング（全API統合）"
            description="Calendar → 乗換 → 天気 → 遅刻確率を一括取得"
            result={results.briefing}
            statusColor={statusColor}
          >
            <HStack gap={2} flexWrap="wrap">
              <Input
                size="sm"
                w="200px"
                placeholder="現在地"
                value={briefingLocation}
                onChange={(e) => setBriefingLocation(e.target.value)}
              />
              <Button
                size="sm"
                colorPalette="orange"
                onClick={() =>
                  run("briefing", () =>
                    fetchMorningBriefing(briefingLocation),
                  )
                }
                disabled={results.briefing.status === "running"}
              >
                ブリーフィング取得
              </Button>
            </HStack>
          </TestCard>

          {/* ---------------------------------------------------------- */}
          {/* Summary */}
          {/* ---------------------------------------------------------- */}
          <Box
            bg="white"
            borderWidth="1px"
            borderRadius="xl"
            p={5}
            borderColor="gray.200"
          >
            <Stack gap={3}>
              <Text fontWeight="bold">接続状態まとめ</Text>
              <HStack gap={4} flexWrap="wrap">
                {(Object.keys(results) as TestId[]).map((id) => (
                  <Badge
                    key={id}
                    colorPalette={statusColor(results[id].status)}
                    variant="subtle"
                  >
                    {id}: {results[id].status}
                    {results[id].ms != null ? ` (${results[id].ms}ms)` : ""}
                  </Badge>
                ))}
              </HStack>
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: TestCard
// ---------------------------------------------------------------------------

function TestCard({
  title,
  description,
  result,
  statusColor,
  children,
}: {
  title: string;
  description: string;
  result: TestResult;
  statusColor: (s: TestResult["status"]) => string;
  children: React.ReactNode;
}) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderRadius="xl"
      p={5}
      borderColor="gray.200"
    >
      <Stack gap={4}>
        <HStack justify="space-between">
          <Stack gap={1}>
            <Heading size="md">{title}</Heading>
            <Text fontSize="sm" color="gray.500">
              {description}
            </Text>
          </Stack>
          <Badge colorPalette={statusColor(result.status)} variant="subtle">
            {result.status}
            {result.ms != null ? ` ${result.ms}ms` : ""}
          </Badge>
        </HStack>

        {children}

        {result.status === "error" && (
          <Box bg="red.50" borderRadius="lg" p={3}>
            <Text fontSize="sm" color="red.700" fontWeight="bold">
              エラー
            </Text>
            <Code
              fontSize="xs"
              whiteSpace="pre-wrap"
              wordBreak="break-all"
              display="block"
              p={2}
              mt={1}
              bg="red.100"
              borderRadius="md"
            >
              {result.error}
            </Code>
          </Box>
        )}

        {result.status === "ok" && result.data != null && (
          <Box bg="green.50" borderRadius="lg" p={3} maxH="300px" overflow="auto">
            <Text fontSize="sm" color="green.700" fontWeight="bold">
              レスポンス
            </Text>
            <Code
              fontSize="xs"
              whiteSpace="pre-wrap"
              wordBreak="break-all"
              display="block"
              p={2}
              mt={1}
              bg="green.100"
              borderRadius="md"
            >
              {JSON.stringify(result.data, null, 2)}
            </Code>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
