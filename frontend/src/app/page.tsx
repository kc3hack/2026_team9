"use client";

import {
  Badge,
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Input,
  List,
  Spinner,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthPanel } from "@/components/auth/auth-panel";
import {
  AuthApiError,
  getSession,
  type SessionResponse,
  signInWithGoogle,
} from "@/lib/auth-api";
import {
  getTaskWorkflowHistory,
  getTaskWorkflowStatus,
  startTaskWorkflow,
  TaskWorkflowApiError,
  type WorkflowRecord,
  type WorkflowRuntimeStatus,
} from "@/lib/task-workflow-api";

type RunPhase = "idle" | "starting" | "waiting" | "completed" | "failed";

type ErrorAction = "start" | "status" | "history" | "session";
const CALENDAR_REAUTH_MARKER = "REAUTH_REQUIRED_CALENDAR_SCOPE:";

function fallbackErrorMessage(action: ErrorAction): string {
  if (action === "start") {
    return "Workflow の開始に失敗しました。";
  }
  if (action === "status") {
    return "Workflow の状態取得に失敗しました。";
  }
  if (action === "history") {
    return "履歴の取得に失敗しました。";
  }
  return "セッション状態の取得に失敗しました。";
}

function toErrorMessage(error: unknown, action: ErrorAction): string {
  if (error instanceof TypeError) {
    return "ネットワーク接続に失敗しました。通信環境を確認してください。";
  }

  if (error instanceof TaskWorkflowApiError || error instanceof AuthApiError) {
    if (error.status === 401) {
      return "ログインが必要です。Google でログインしてください。";
    }
    if (error.status >= 500) {
      return "サーバー側でエラーが発生しました。時間をおいて再試行してください。";
    }
  }

  return fallbackErrorMessage(action);
}

function needsCalendarReauth(rawMessage: string | null): boolean {
  return Boolean(rawMessage?.includes(CALENDAR_REAUTH_MARKER));
}

function toDisplayErrorMessage(rawMessage: string | null): string | null {
  if (!rawMessage) {
    return null;
  }

  if (!needsCalendarReauth(rawMessage)) {
    return rawMessage;
  }

  const message = rawMessage.replace(CALENDAR_REAUTH_MARKER, "").trim();
  if (message.length > 0) {
    return message;
  }

  return "Google Calendar の権限再許可が必要です。";
}

function formatDateTime(
  value: string | null | undefined,
  timezone?: string | null,
): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("ja-JP", {
    timeZone: timezone ?? undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toStatusLabel(
  phase: RunPhase,
  workflowStatus: WorkflowRuntimeStatus | null,
  record: WorkflowRecord | null,
): string {
  if (phase === "starting") {
    return "開始中";
  }

  if (record?.status) {
    if (record.status === "queued") {
      return "キュー待ち";
    }
    if (record.status === "running") {
      return "細分化中";
    }
    if (record.status === "calendar_syncing") {
      return "カレンダー反映中";
    }
    if (record.status === "completed") {
      return "完了";
    }
    return "失敗";
  }

  if (workflowStatus) {
    if (workflowStatus.status === "running") {
      return "実行中";
    }
    if (workflowStatus.status === "complete") {
      return "完了";
    }
    if (
      workflowStatus.status === "errored" ||
      workflowStatus.status === "terminated"
    ) {
      return "失敗";
    }
  }

  if (phase === "waiting") {
    return "待機中";
  }

  return "未実行";
}

function toDeadlineIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

export default function Home() {
  const [session, setSession] = useState<SessionResponse>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  const [task, setTask] = useState("");
  const [context, setContext] = useState("");
  const [deadline, setDeadline] = useState("");
  const [maxSteps, setMaxSteps] = useState("6");

  const [phase, setPhase] = useState<RunPhase>("idle");
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] =
    useState<WorkflowRuntimeStatus | null>(null);
  const [record, setRecord] = useState<WorkflowRecord | null>(null);
  const [history, setHistory] = useState<WorkflowRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReauthRunning, setIsReauthRunning] = useState(false);
  const [dotTick, setDotTick] = useState(0);

  const signedInUser = useMemo(() => session?.user ?? null, [session]);
  const requiresCalendarReauth = useMemo(
    () => needsCalendarReauth(errorMessage),
    [errorMessage],
  );
  const displayErrorMessage = useMemo(
    () => toDisplayErrorMessage(errorMessage),
    [errorMessage],
  );
  const statusLabel = useMemo(
    () => toStatusLabel(phase, workflowStatus, record),
    [phase, workflowStatus, record],
  );

  const refreshSession = useCallback(async () => {
    setIsSessionLoading(true);
    try {
      const nextSession = await getSession();
      setSession(nextSession);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "session"));
      setSession(null);
    } finally {
      setIsSessionLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    if (!signedInUser) {
      setHistory([]);
      return;
    }

    try {
      const response = await getTaskWorkflowHistory(8);
      setHistory(response.items);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "history"));
    }
  }, [signedInUser]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (phase !== "waiting") {
      setDotTick(0);
      return;
    }

    const timer = window.setInterval(() => {
      setDotTick((prev) => (prev + 1) % 3);
    }, 420);

    return () => {
      window.clearInterval(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (!workflowId || phase !== "waiting") {
      return;
    }

    let active = true;
    let inFlight = false;

    const poll = async () => {
      if (inFlight) {
        return;
      }

      inFlight = true;
      try {
        const response = await getTaskWorkflowStatus(workflowId);
        if (!active) {
          return;
        }

        setWorkflowStatus(response.workflowStatus);
        setRecord(response.record);

        if (response.record?.status === "completed") {
          setPhase("completed");
          setErrorMessage(null);
          void refreshHistory();
          return;
        }

        if (response.record?.status === "failed") {
          setPhase("failed");
          setErrorMessage(
            response.record.errorMessage ?? "Workflow が失敗しました。",
          );
          void refreshHistory();
          return;
        }

        if (
          response.workflowStatus.status === "errored" ||
          response.workflowStatus.status === "terminated"
        ) {
          setPhase("failed");
          setErrorMessage(
            response.workflowStatus.error?.message ??
              "Workflow が異常終了しました。",
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(toErrorMessage(error, "status"));
        if (error instanceof TaskWorkflowApiError && error.status === 401) {
          setPhase("failed");
        }
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 2500);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [workflowId, phase, refreshHistory]);

  const handleSubmit = async (event: FormEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!signedInUser) {
      setErrorMessage(
        "実行にはログインが必要です。Google でログインしてください。",
      );
      return;
    }

    const trimmedTask = task.trim();
    if (trimmedTask.length === 0) {
      setErrorMessage("タスク入力は必須です。");
      return;
    }

    const parsedMaxSteps = Number(maxSteps);
    const safeMaxSteps = Number.isFinite(parsedMaxSteps)
      ? Math.min(Math.max(Math.trunc(parsedMaxSteps), 1), 12)
      : 6;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

    setPhase("starting");
    setErrorMessage(null);

    try {
      const response = await startTaskWorkflow({
        task: trimmedTask,
        context: context.trim().length > 0 ? context.trim() : undefined,
        deadline: toDeadlineIso(deadline),
        timezone,
        maxSteps: safeMaxSteps,
      });

      setWorkflowId(response.id);
      setWorkflowStatus(response.workflowStatus);
      setRecord(response.record);

      if (response.record?.status === "completed") {
        setPhase("completed");
      } else if (response.record?.status === "failed") {
        setPhase("failed");
        setErrorMessage(
          response.record.errorMessage ?? "Workflow が失敗しました。",
        );
      } else {
        setPhase("waiting");
      }

      await refreshHistory();
    } catch (error) {
      setPhase("failed");
      setErrorMessage(toErrorMessage(error, "start"));
    }
  };

  const handleSelectHistory = (item: WorkflowRecord) => {
    setWorkflowId(item.workflowId);
    setRecord(item);
    setWorkflowStatus(null);
    setErrorMessage(null);

    if (item.status === "completed") {
      setPhase("completed");
      return;
    }

    if (item.status === "failed") {
      setPhase("failed");
      setErrorMessage(item.errorMessage ?? "Workflow が失敗しました。");
      return;
    }

    setPhase("waiting");
  };

  const handleCalendarReauth = async () => {
    setIsReauthRunning(true);
    try {
      await signInWithGoogle(window.location.href);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "session"));
      setIsReauthRunning(false);
      return;
    }

    setIsReauthRunning(false);
  };

  const waitingDots = ".".repeat(dotTick + 1);
  const breakdown = record?.llmOutput;
  const calendarResult = record?.calendarOutput;

  return (
    <Box
      minH="100dvh"
      bg="var(--app-bg)"
      px={{ base: 4, md: 8 }}
      py={{ base: 8, md: 12 }}
    >
      <Container maxW="4xl">
        <Stack gap={6}>
          <HStack gap={3} flexWrap="wrap">
            <Badge colorPalette="teal" size="md">
              Task Workflow
            </Badge>
            <Badge colorPalette="blue" size="md">
              Google Calendar
            </Badge>
            <Badge colorPalette="green" size="md">
              Workers AI
            </Badge>
          </HStack>

          <Stack gap={2}>
            <Heading size="2xl" lineHeight="1.15">
              タスク細分化ワークフロー
            </Heading>
            <Text fontSize="lg" color="fg.muted">
              入力したタスクを細分化し、Google Calendar に自動反映します。
            </Text>
          </Stack>

          <AuthPanel />

          <Box
            bg="var(--app-surface)"
            borderWidth="1px"
            borderColor="var(--app-border)"
            borderRadius="2xl"
            p={{ base: 5, md: 7 }}
            as="form"
            onSubmit={handleSubmit}
          >
            <Stack gap={4}>
              <HStack justify="space-between" flexWrap="wrap">
                <Text fontWeight="semibold">タスク入力</Text>
                <Badge
                  colorPalette={
                    phase === "completed"
                      ? "green"
                      : phase === "failed"
                        ? "red"
                        : "blue"
                  }
                >
                  {statusLabel}
                </Badge>
              </HStack>

              <Stack gap={2}>
                <Text fontSize="sm" color="fg.muted">
                  細分化したいタスク
                </Text>
                <Textarea
                  value={task}
                  onChange={(event) => setTask(event.target.value)}
                  placeholder="例: ハッカソン発表までに、プロトタイプを提出可能な状態にする"
                  minH="120px"
                />
              </Stack>

              <Stack gap={2}>
                <Text fontSize="sm" color="fg.muted">
                  補足コンテキスト（任意）
                </Text>
                <Textarea
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder="例: 3人チーム、締切は来週金曜、担当はフロント中心"
                  minH="90px"
                />
              </Stack>

              <HStack align="start" gap={4} flexWrap="wrap">
                <Stack gap={2} flex="1" minW={{ base: "100%", md: "260px" }}>
                  <Text fontSize="sm" color="fg.muted">
                    最終期限（任意）
                  </Text>
                  <Input
                    type="datetime-local"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                  />
                </Stack>

                <Stack gap={2} w={{ base: "100%", md: "160px" }}>
                  <Text fontSize="sm" color="fg.muted">
                    最大ステップ数
                  </Text>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={maxSteps}
                    onChange={(event) => setMaxSteps(event.target.value)}
                  />
                </Stack>
              </HStack>

              <HStack gap={3} flexWrap="wrap">
                <Button
                  colorPalette="teal"
                  type="submit"
                  loading={phase === "starting"}
                  disabled={phase === "waiting" || isSessionLoading}
                >
                  {phase === "waiting" ? "実行中" : "細分化を開始"}
                </Button>
                <Text fontSize="sm" color="fg.muted">
                  {signedInUser
                    ? `ログイン中: ${signedInUser.email}`
                    : "ログインすると実行できます"}
                </Text>
              </HStack>

              {workflowId ? (
                <Text fontSize="xs" color="fg.muted">
                  Workflow ID: {workflowId}
                </Text>
              ) : null}

              {displayErrorMessage ? (
                <Text fontSize="sm" color="red.500">
                  {displayErrorMessage}
                </Text>
              ) : null}

              {requiresCalendarReauth ? (
                <HStack gap={3} flexWrap="wrap">
                  <Button
                    size="sm"
                    colorPalette="orange"
                    variant="outline"
                    onClick={() => void handleCalendarReauth()}
                    loading={isReauthRunning}
                  >
                    Google権限を再認可
                  </Button>
                  <Text fontSize="xs" color="fg.muted">
                    権限許可後に同じタスクを再実行してください。
                  </Text>
                </HStack>
              ) : null}
            </Stack>
          </Box>

          {phase === "waiting" ? (
            <Box
              bg="var(--app-surface)"
              borderWidth="1px"
              borderColor="var(--app-border)"
              borderRadius="2xl"
              p={{ base: 5, md: 7 }}
            >
              <Stack gap={4} align="center" textAlign="center">
                <Spinner size="xl" color="teal.500" />
                <Heading size="md">ワークフロー実行中{waitingDots}</Heading>
                <Text color="fg.muted" fontSize="sm">
                  ステータスを定期確認し、D1
                  に結果が保存され次第この画面が自動更新されます。
                </Text>
                <HStack gap={3}>
                  <Badge colorPalette="blue">
                    {workflowStatus?.status ?? "running"}
                  </Badge>
                  <Badge colorPalette="teal">
                    {record?.status ?? "running"}
                  </Badge>
                </HStack>
              </Stack>
            </Box>
          ) : null}

          {phase === "completed" && breakdown ? (
            <Box
              bg="var(--app-surface)"
              borderWidth="1px"
              borderColor="var(--app-border)"
              borderRadius="2xl"
              p={{ base: 5, md: 7 }}
            >
              <Stack gap={5}>
                <Heading size="lg">分解結果</Heading>
                <Stack gap={1}>
                  <Text fontWeight="semibold">目標</Text>
                  <Text color="fg.muted">{breakdown.goal}</Text>
                </Stack>

                <Stack gap={1}>
                  <Text fontWeight="semibold">要約</Text>
                  <Text color="fg.muted">{breakdown.summary}</Text>
                </Stack>

                <Stack gap={2}>
                  <Text fontWeight="semibold">サブタスク</Text>
                  <List.Root gap={2}>
                    {breakdown.subtasks.map((subtask) => (
                      <List.Item key={`${subtask.title}-${subtask.dueAt}`}>
                        <Stack gap={1}>
                          <Text fontWeight="medium">{subtask.title}</Text>
                          <Text fontSize="sm" color="fg.muted">
                            {subtask.description}
                          </Text>
                          <HStack gap={3} flexWrap="wrap">
                            <Badge colorPalette="blue" variant="subtle">
                              期限:{" "}
                              {formatDateTime(subtask.dueAt, record?.timezone)}
                            </Badge>
                            <Badge colorPalette="teal" variant="subtle">
                              {subtask.durationMinutes} 分
                            </Badge>
                          </HStack>
                        </Stack>
                      </List.Item>
                    ))}
                  </List.Root>
                </Stack>

                {calendarResult ? (
                  <Stack gap={2}>
                    <Text fontWeight="semibold">Google Calendar 反映結果</Text>
                    <List.Root gap={2}>
                      {calendarResult.createdEvents.map((eventItem) => (
                        <List.Item key={eventItem.id}>
                          <HStack justify="space-between" align="start" gap={3}>
                            <Stack gap={1}>
                              <Text fontWeight="medium">
                                {eventItem.summary}
                              </Text>
                              <Text fontSize="sm" color="fg.muted">
                                {formatDateTime(
                                  eventItem.startAt,
                                  calendarResult.timezone,
                                )}{" "}
                                -{" "}
                                {formatDateTime(
                                  eventItem.endAt,
                                  calendarResult.timezone,
                                )}
                              </Text>
                            </Stack>
                            {eventItem.htmlLink ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  window.open(
                                    eventItem.htmlLink ?? "",
                                    "_blank",
                                    "noopener,noreferrer",
                                  );
                                }}
                              >
                                カレンダーを開く
                              </Button>
                            ) : (
                              <Badge colorPalette="gray">リンクなし</Badge>
                            )}
                          </HStack>
                        </List.Item>
                      ))}
                    </List.Root>
                  </Stack>
                ) : null}

                {breakdown.assumptions.length > 0 ? (
                  <Stack gap={2}>
                    <Text fontWeight="semibold">前提 / メモ</Text>
                    <List.Root gap={1}>
                      {breakdown.assumptions.map((item) => (
                        <List.Item key={item}>{item}</List.Item>
                      ))}
                    </List.Root>
                  </Stack>
                ) : null}
              </Stack>
            </Box>
          ) : null}

          <Box
            bg="var(--app-surface)"
            borderWidth="1px"
            borderColor="var(--app-border)"
            borderRadius="2xl"
            p={{ base: 5, md: 7 }}
          >
            <Stack gap={4}>
              <HStack justify="space-between" flexWrap="wrap">
                <Text fontWeight="semibold">最近の実行履歴</Text>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void refreshHistory()}
                >
                  更新
                </Button>
              </HStack>

              {history.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  まだ履歴はありません。
                </Text>
              ) : (
                <List.Root gap={2}>
                  {history.map((item) => (
                    <List.Item key={item.workflowId}>
                      <HStack justify="space-between" align="start" gap={3}>
                        <Stack gap={1}>
                          <Text fontWeight="medium">{item.taskInput}</Text>
                          <Text fontSize="xs" color="fg.muted">
                            {formatDateTime(item.createdAt, item.timezone)} /{" "}
                            {item.status}
                          </Text>
                        </Stack>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleSelectHistory(item)}
                        >
                          表示
                        </Button>
                      </HStack>
                    </List.Item>
                  ))}
                </List.Root>
              )}
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
