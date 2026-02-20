"use client";

import { useEffect, useMemo, useState } from "react";
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
import { getMorningDashboard } from "@/lib/morning-dashboard-api";
import type { MorningDashboard } from "@/lib/morning-dashboard-api";

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
    <Box
      minH="100dvh"
      bg="linear-gradient(180deg, #f7f7fb 0%, #eef2f7 50%, #f6fbf8 100%)"
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        inset="0"
        bgGradient="radial(circle at top left, rgba(39,97,245,0.18), transparent 55%)"
        pointerEvents="none"
      />
      <Box
        position="absolute"
        inset="0"
        bgGradient="radial(circle at 80% 20%, rgba(7,214,152,0.12), transparent 60%)"
        pointerEvents="none"
      />
      <Box
        position="absolute"
        inset="0"
        opacity={0.12}
        backgroundImage="linear-gradient(rgba(12,19,28,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(12,19,28,0.08) 1px, transparent 1px)"
        backgroundSize="36px 36px"
        pointerEvents="none"
      />

      <Container maxW="5xl" px={{ base: 4, md: 8 }} py={{ base: 10, md: 14 }}>
        <Stack gap={{ base: 8, md: 12 }}>
          <Stack gap={4}>
            <HStack gap={3}>
              <Badge colorPalette="green" variant="subtle">
                Morning Flow
              </Badge>
              <Badge colorPalette="blue" variant="outline">
                Dashboard
              </Badge>
            </HStack>
            <Heading size="2xl" lineHeight="1.1" color="gray.900">
              朝準備ダッシュボード
            </Heading>
            <Text fontSize="lg" color="gray.600">
              出発時刻から逆算して、次にやることと残り時間を整える。
            </Text>
          </Stack>

          <Grid
            templateColumns={{ base: "1fr", md: "1.1fr 0.9fr" }}
            gap={{ base: 6, md: 8 }}
          >
            <Box
              bg="white"
              borderRadius="3xl"
              p={{ base: 6, md: 8 }}
              borderWidth="1px"
              borderColor="gray.200"
              boxShadow="0 20px 50px rgba(22, 30, 45, 0.08)"
            >
              <Stack gap={6}>
                <Flex justify="space-between" align="center">
                  <Stack gap={1}>
                    <Text fontSize="sm" color="gray.500">
                      今日
                    </Text>
                    <Heading size="lg" color="gray.900">
                      {state.data?.date ?? "----/--/--"}
                    </Heading>
                  </Stack>
                  <Badge
                    colorPalette={
                      state.status === "error" ? "red" : "green"
                    }
                    variant="subtle"
                  >
                    {state.status === "loading"
                      ? "読み込み中"
                      : state.status === "error"
                        ? "読み込み失敗"
                        : "同期済み"}
                  </Badge>
                </Flex>

                <Grid
                  templateColumns={{ base: "1fr", sm: "repeat(3, 1fr)" }}
                  gap={4}
                >
                  <Box
                    borderWidth="1px"
                    borderRadius="2xl"
                    p={4}
                    borderColor="gray.200"
                    bg="gray.50"
                  >
                    <Text fontSize="xs" color="gray.500">
                      起きる時間
                    </Text>
                    <Heading size="md" color="gray.900">
                      {state.data?.wakeUpTime ?? "--:--"}
                    </Heading>
                  </Box>
                  <Box
                    borderWidth="1px"
                    borderRadius="2xl"
                    p={4}
                    borderColor="gray.200"
                    bg="gray.50"
                  >
                    <Text fontSize="xs" color="gray.500">
                      出発時間
                    </Text>
                    <Heading size="md" color="gray.900">
                      {state.data?.departTime ?? "--:--"}
                    </Heading>
                  </Box>
                  <Box
                    borderWidth="1px"
                    borderRadius="2xl"
                    p={4}
                    borderColor="gray.200"
                    bg="gray.50"
                  >
                    <Text fontSize="xs" color="gray.500">
                      最初の予定
                    </Text>
                    <Text fontWeight="semibold" color="gray.900">
                      {state.data?.earliestEvent?.title ?? "未登録"}
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      {state.data?.earliestEvent?.startTime ?? "--:--"}{" "}
                      {state.data?.earliestEvent?.location ?? ""}
                    </Text>
                  </Box>
                </Grid>

                <Box
                  borderWidth="1px"
                  borderRadius="2xl"
                  p={5}
                  bg="gray.50"
                  borderColor="gray.200"
                >
                  <Text fontSize="sm" color="gray.500">
                    ルーティン概要
                  </Text>
                  <Text fontWeight="semibold" color="gray.900">
                    {state.data?.routine.length ?? 0} ステップを自動配置
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    更新: {state.data?.updatedAt ?? "--"}
                  </Text>
                </Box>
              </Stack>
            </Box>

            <Box
              bg="white"
              color="gray.900"
              borderRadius="3xl"
              p={{ base: 6, md: 8 }}
              borderWidth="1px"
              borderColor="gray.200"
              boxShadow="0 20px 50px rgba(22, 30, 45, 0.08)"
            >
              <Stack gap={6}>
                <Heading size="md">今日の変更</Heading>
                {state.data?.overrides?.length ? (
                  state.data.overrides.map((override) => (
                    <Box
                      key={override.date}
                      borderWidth="1px"
                      borderColor="gray.200"
                      borderRadius="2xl"
                      p={4}
                      bg="gray.50"
                    >
                      <Text fontSize="sm" color="gray.500">
                        {override.date}
                      </Text>
                      <Text fontWeight="semibold">
                        {override.note ?? "特記事項なし"}
                      </Text>
                      <Stack mt={3} gap={2}>
                        {override.steps.map((step) => (
                          <HStack key={step.id} justify="space-between">
                            <Text fontSize="sm">{step.label}</Text>
                            <Badge colorPalette="yellow" variant="subtle">
                              追加
                            </Badge>
                          </HStack>
                        ))}
                      </Stack>
                    </Box>
                  ))
                ) : (
                  <Text fontSize="sm" color="gray.500">
                    今日は標準ルーティンで運用中。
                  </Text>
                )}
              </Stack>
            </Box>
          </Grid>

          <Box
            bg="white"
            borderRadius="3xl"
            p={{ base: 6, md: 8 }}
            borderWidth="1px"
            borderColor="gray.200"
            boxShadow="0 20px 50px rgba(22, 30, 45, 0.08)"
          >
            <Stack gap={6}>
              <HStack justify="space-between">
                <Heading size="md" color="gray.900">
                  タイムライン
                </Heading>
                <Badge colorPalette="green" variant="outline">
                  出発までの逆算
                </Badge>
              </HStack>

              {routine.length === 0 ? (
                state.status === "error" ? (
                  <Text color="red.500">
                    タイムラインの取得に失敗しました。
                  </Text>
                ) : (
                  <Text color="gray.500">データを読み込んでいます。</Text>
                )
              ) : (
                <Stack gap={3}>
                  {routine.map((step) => (
                    <Flex
                      key={step.id}
                      justify="space-between"
                      align="center"
                      borderWidth="1px"
                      borderRadius="2xl"
                      px={4}
                      py={3}
                      borderColor="gray.200"
                      bg="gray.50"
                    >
                      <HStack gap={3}>
                        <Badge
                          colorPalette={step.isOverride ? "yellow" : "green"}
                        >
                          {step.isOverride ? "変更" : "基本"}
                        </Badge>
                        <Text fontWeight="semibold" color="gray.900">
                          {step.label}
                        </Text>
                      </HStack>
                      <Text fontWeight="semibold" color="gray.900">
                        {state.data
                          ? toClockString(
                              state.data.departTime,
                              step.offsetMinutes,
                            )
                          : "--:--"}
                      </Text>
                    </Flex>
                  ))}
                </Stack>
              )}
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
