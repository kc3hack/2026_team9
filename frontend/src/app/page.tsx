"use client";

import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Field,
  Heading,
  HStack,
  Input,
  List,
  ProgressCircle,
  Stack,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthPanel } from "@/components/auth/auth-panel";
import {
  AuthApiError,
  getSession,
  type SessionResponse,
  signInWithGoogle,
  signOut,
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
type ErrorAction = "start" | "status" | "history" | "session" | "signOut";
type ViewMode = "auth" | "compose" | "running" | "result";
type TransitionDirection = "forward" | "backward";

type StepItem = {
  label: string;
};

const CALENDAR_REAUTH_MARKER = "REAUTH_REQUIRED_CALENDAR_SCOPE:";
const DEFAULT_USER_TIMEZONE = "Asia/Tokyo";
const STEP_ITEMS: StepItem[] = [
  { label: "認証" },
  { label: "入力" },
  { label: "実行" },
  { label: "結果" },
];

function viewIndex(view: ViewMode): number {
  if (view === "auth") {
    return 0;
  }
  if (view === "compose") {
    return 1;
  }
  if (view === "running") {
    return 2;
  }
  return 3;
}

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
  if (action === "signOut") {
    return "ログアウトに失敗しました。時間をおいて再試行してください。";
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
    timeZone: timezone ?? DEFAULT_USER_TIMEZONE,
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
    return toStatusLabelFromRecord(record.status);
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

function toStatusLabelFromRecord(status: WorkflowRecord["status"]): string {
  if (status === "queued") {
    return "キュー待ち";
  }
  if (status === "running") {
    return "細分化中";
  }
  if (status === "calendar_syncing") {
    return "カレンダー反映中";
  }
  if (status === "completed") {
    return "完了";
  }
  return "失敗";
}

function toWorkflowProgress(
  phase: RunPhase,
  record: WorkflowRecord | null,
  workflowStatus: WorkflowRuntimeStatus | null,
): number {
  if (phase === "starting") {
    return 15;
  }

  if (record?.status) {
    if (record.status === "queued") {
      return 25;
    }
    if (record.status === "running") {
      return 58;
    }
    if (record.status === "calendar_syncing") {
      return 84;
    }
    return 100;
  }

  if (workflowStatus?.status === "complete") {
    return 100;
  }
  if (
    workflowStatus?.status === "errored" ||
    workflowStatus?.status === "terminated"
  ) {
    return 100;
  }
  if (phase === "waiting") {
    return 45;
  }

  return 0;
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

function toInitials(name: string | null | undefined): string {
  if (!name || name.trim().length === 0) {
    return "GU";
  }

  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .filter((part) => part.length > 0)
    .join("");

  return letters.length > 0 ? letters : "GU";
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
  const [isSignOutRunning, setIsSignOutRunning] = useState(false);
  const [dotTick, setDotTick] = useState(0);

  const [resultTab, setResultTab] = useState<"result" | "history">("result");
  const [viewMode, setViewMode] = useState<ViewMode>("auth");
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>("forward");

  const viewModeRef = useRef<ViewMode>("auth");

  const signedInUser = useMemo(() => session?.user ?? null, [session]);
  const statusLabel = useMemo(
    () => toStatusLabel(phase, workflowStatus, record),
    [phase, workflowStatus, record],
  );
  const workflowProgress = useMemo(
    () => toWorkflowProgress(phase, record, workflowStatus),
    [phase, record, workflowStatus],
  );
  const requiresCalendarReauth = useMemo(
    () => needsCalendarReauth(errorMessage),
    [errorMessage],
  );
  const displayErrorMessage = useMemo(
    () => toDisplayErrorMessage(errorMessage),
    [errorMessage],
  );

  const setView = useCallback((nextView: ViewMode) => {
    const previous = viewModeRef.current;
    if (previous === nextView) {
      return;
    }

    setTransitionDirection(
      viewIndex(nextView) > viewIndex(previous) ? "forward" : "backward",
    );
    viewModeRef.current = nextView;
    setViewMode(nextView);
  }, []);

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
    const pollIntervalMs =
      record?.status === "running" || record?.status === "calendar_syncing"
        ? 5000
        : 3000;
    const timer = window.setInterval(() => {
      void poll();
    }, pollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [workflowId, phase, record?.status, refreshHistory]);

  useEffect(() => {
    let nextView: ViewMode;

    if (!signedInUser) {
      nextView = "auth";
    } else if (phase === "starting" || phase === "waiting") {
      nextView = "running";
    } else if (
      phase === "completed" ||
      phase === "failed" ||
      record?.status === "completed" ||
      record?.status === "failed"
    ) {
      nextView = "result";
    } else {
      nextView = "compose";
    }

    setView(nextView);
  }, [phase, record?.status, setView, signedInUser]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

    const deadlineIso = toDeadlineIso(deadline);
    if (deadline.trim().length > 0 && !deadlineIso) {
      setErrorMessage("最終期限の形式が正しくありません。");
      return;
    }

    const parsedMaxSteps = Number(maxSteps);
    const safeMaxSteps = Number.isFinite(parsedMaxSteps)
      ? Math.min(Math.max(Math.trunc(parsedMaxSteps), 1), 12)
      : 6;
    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? DEFAULT_USER_TIMEZONE;

    setPhase("starting");
    setErrorMessage(null);

    try {
      const response = await startTaskWorkflow({
        task: trimmedTask,
        context: context.trim().length > 0 ? context.trim() : undefined,
        deadline: deadlineIso,
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
    setResultTab("result");

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

  const handleStartNewTask = () => {
    setPhase("idle");
    setWorkflowId(null);
    setWorkflowStatus(null);
    setRecord(null);
    setErrorMessage(null);
    setResultTab("result");
  };

  const handleSignOut = async () => {
    setIsSignOutRunning(true);
    try {
      await signOut();
      setSession(null);
      setHistory([]);
      setTask("");
      setContext("");
      setDeadline("");
      setMaxSteps("6");
      handleStartNewTask();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "signOut"));
    } finally {
      setIsSignOutRunning(false);
    }
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

  const handleAuthPanelSessionChanged = useCallback(
    (nextSession: SessionResponse) => {
      setSession(nextSession);
      setIsSessionLoading(false);
    },
    [],
  );

  const currentStepIndex = viewIndex(viewMode);
  const waitingDots = ".".repeat(dotTick + 1);
  const breakdown = record?.llmOutput;
  const calendarResult = record?.calendarOutput;

  const screenBody = (() => {
    if (viewMode === "auth") {
      return (
        <Stack gap={5}>
          <Text color="fg.muted" fontSize="sm">
            まずGoogleでログインし、カレンダー連携権限を許可してください。
            認証後はタスク入力画面に進みます。
          </Text>
          <AuthPanel onSessionChanged={handleAuthPanelSessionChanged} />
        </Stack>
      );
    }

    if (viewMode === "compose") {
      return (
        <Stack gap={5}>
          <form onSubmit={handleSubmit}>
            <Stack gap={4}>
              <Field.Root required>
                <Field.Label>細分化したいタスク</Field.Label>
                <Textarea
                  value={task}
                  onChange={(event) => setTask(event.target.value)}
                  placeholder="例: ハッカソン発表までに、プロトタイプを提出可能な状態にする"
                  minH="140px"
                />
              </Field.Root>

              <Field.Root>
                <Field.Label>補足コンテキスト（任意）</Field.Label>
                <Textarea
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder="例: 3人チーム、担当はフロント中心、毎日21時以降に作業"
                  minH="96px"
                />
              </Field.Root>

              <HStack align="start" gap={4} flexWrap="wrap">
                <Field.Root flex="1" minW={{ base: "100%", md: "260px" }}>
                  <Field.Label>最終期限（任意）</Field.Label>
                  <Input
                    type="datetime-local"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                  />
                  <Field.HelperText>
                    未入力でも、本文と文脈から期限を推測して分解します。
                  </Field.HelperText>
                </Field.Root>

                <Field.Root w={{ base: "100%", md: "160px" }}>
                  <Field.Label>最大ステップ数</Field.Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={maxSteps}
                    onChange={(event) => setMaxSteps(event.target.value)}
                  />
                </Field.Root>
              </HStack>

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

              <HStack justify="end">
                <Button
                  colorPalette="teal"
                  type="submit"
                  loading={phase === "starting"}
                  disabled={phase === "waiting" || isSessionLoading}
                >
                  細分化を開始
                </Button>
              </HStack>
            </Stack>
          </form>

          {history.length > 0 ? (
            <Card.Root variant="outline" bg="var(--app-surface-soft)">
              <Card.Header pb={2}>
                <Card.Title fontSize="md">最近の履歴</Card.Title>
              </Card.Header>
              <Card.Body>
                <List.Root gap={2}>
                  {history.slice(0, 3).map((item) => (
                    <List.Item key={item.workflowId}>
                      <HStack justify="space-between" align="start" gap={3}>
                        <Stack gap={0.5}>
                          <Text fontSize="sm" lineClamp={2}>
                            {item.taskInput}
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            {formatDateTime(item.createdAt, item.timezone)} /{" "}
                            {toStatusLabelFromRecord(item.status)}
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
              </Card.Body>
            </Card.Root>
          ) : null}
        </Stack>
      );
    }

    if (viewMode === "running") {
      return (
        <Stack
          align="center"
          textAlign="center"
          gap={5}
          py={{ base: 4, md: 8 }}
        >
          <ProgressCircle.Root
            value={workflowProgress}
            size="xl"
            colorPalette={phase === "failed" ? "red" : "teal"}
          >
            <ProgressCircle.Circle>
              <ProgressCircle.Track />
              <ProgressCircle.Range />
            </ProgressCircle.Circle>
            <ProgressCircle.ValueText>
              {workflowProgress}%
            </ProgressCircle.ValueText>
          </ProgressCircle.Root>

          <Stack gap={1}>
            <Heading size="md">ワークフロー実行中{waitingDots}</Heading>
            <Text color="fg.muted" fontSize="sm">
              完了したら自動で結果画面へ切り替わります。
            </Text>
          </Stack>

          <Badge colorPalette={phase === "failed" ? "red" : "teal"}>
            {statusLabel}
          </Badge>

          {displayErrorMessage ? (
            <Text fontSize="sm" color="red.500">
              {displayErrorMessage}
            </Text>
          ) : null}

          {requiresCalendarReauth ? (
            <Button
              size="sm"
              colorPalette="orange"
              variant="outline"
              onClick={() => void handleCalendarReauth()}
              loading={isReauthRunning}
            >
              Google権限を再認可
            </Button>
          ) : null}
        </Stack>
      );
    }

    return (
      <Stack gap={5}>
        <HStack justify="space-between" flexWrap="wrap" gap={3}>
          <Badge colorPalette={phase === "failed" ? "red" : "green"}>
            {statusLabel}
          </Badge>
          <Button variant="outline" onClick={handleStartNewTask}>
            新しいタスクを入力
          </Button>
        </HStack>

        <Tabs.Root
          value={resultTab}
          onValueChange={(details) => {
            if (details.value === "result" || details.value === "history") {
              setResultTab(details.value);
            }
          }}
        >
          <Tabs.List>
            <Tabs.Trigger value="result">分解結果</Tabs.Trigger>
            <Tabs.Trigger value="history">実行履歴</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="result" pt={4}>
            {breakdown ? (
              <Stack gap={4}>
                <Card.Root variant="outline" bg="var(--app-surface-soft)">
                  <Card.Body>
                    <Stack gap={2}>
                      <Text fontWeight="semibold">目標</Text>
                      <Text color="fg.muted">{breakdown.goal}</Text>
                      <Text fontWeight="semibold" pt={2}>
                        要約
                      </Text>
                      <Text color="fg.muted">{breakdown.summary}</Text>
                    </Stack>
                  </Card.Body>
                </Card.Root>

                <Card.Root variant="outline" bg="var(--app-surface-soft)">
                  <Card.Header pb={2}>
                    <Card.Title fontSize="md">サブタスク</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <List.Root gap={3}>
                      {breakdown.subtasks.map((subtask, index) => (
                        <List.Item key={`${index}-${subtask.title}`}>
                          <Stack gap={1}>
                            <Text fontWeight="medium">{subtask.title}</Text>
                            <Text fontSize="sm" color="fg.muted">
                              {subtask.description}
                            </Text>
                            <HStack gap={2} flexWrap="wrap">
                              <Badge colorPalette="blue" variant="subtle">
                                期限:{" "}
                                {formatDateTime(
                                  subtask.dueAt,
                                  record?.timezone,
                                )}
                              </Badge>
                              <Badge colorPalette="teal" variant="subtle">
                                {subtask.durationMinutes} 分
                              </Badge>
                            </HStack>
                          </Stack>
                        </List.Item>
                      ))}
                    </List.Root>
                  </Card.Body>
                </Card.Root>

                {calendarResult ? (
                  <Card.Root variant="outline" bg="var(--app-surface-soft)">
                    <Card.Header pb={2}>
                      <Card.Title fontSize="md">
                        Google Calendar 反映結果
                      </Card.Title>
                    </Card.Header>
                    <Card.Body>
                      <List.Root gap={2}>
                        {calendarResult.createdEvents.map((eventItem) => (
                          <List.Item key={eventItem.id}>
                            <HStack
                              justify="space-between"
                              align="start"
                              gap={3}
                            >
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
                                    if (!eventItem.htmlLink) {
                                      return;
                                    }
                                    window.open(
                                      eventItem.htmlLink,
                                      "_blank",
                                      "noopener,noreferrer",
                                    );
                                  }}
                                >
                                  開く
                                </Button>
                              ) : (
                                <Badge colorPalette="gray">リンクなし</Badge>
                              )}
                            </HStack>
                          </List.Item>
                        ))}
                      </List.Root>
                    </Card.Body>
                  </Card.Root>
                ) : null}

                {breakdown.assumptions.length > 0 ? (
                  <Card.Root variant="outline" bg="var(--app-surface-soft)">
                    <Card.Header pb={2}>
                      <Card.Title fontSize="md">前提 / メモ</Card.Title>
                    </Card.Header>
                    <Card.Body>
                      <List.Root gap={1}>
                        {breakdown.assumptions.map((item) => (
                          <List.Item key={item}>{item}</List.Item>
                        ))}
                      </List.Root>
                    </Card.Body>
                  </Card.Root>
                ) : null}
              </Stack>
            ) : (
              <Card.Root variant="outline" bg="var(--app-surface-soft)">
                <Card.Body>
                  <Text fontSize="sm" color="fg.muted">
                    結果がありません。失敗した場合は履歴から詳細を確認してください。
                  </Text>
                  {displayErrorMessage ? (
                    <Text fontSize="sm" color="red.500" mt={2}>
                      {displayErrorMessage}
                    </Text>
                  ) : null}
                </Card.Body>
              </Card.Root>
            )}
          </Tabs.Content>

          <Tabs.Content value="history" pt={4}>
            <Card.Root variant="outline" bg="var(--app-surface-soft)">
              <Card.Body>
                {history.length === 0 ? (
                  <Text fontSize="sm" color="fg.muted">
                    まだ履歴はありません。
                  </Text>
                ) : (
                  <List.Root gap={3}>
                    {history.map((item) => (
                      <List.Item key={item.workflowId}>
                        <HStack justify="space-between" align="start" gap={3}>
                          <Stack gap={0.5}>
                            <Text fontWeight="medium">{item.taskInput}</Text>
                            <Text fontSize="xs" color="fg.muted">
                              {formatDateTime(item.createdAt, item.timezone)} /{" "}
                              {toStatusLabelFromRecord(item.status)}
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
              </Card.Body>
            </Card.Root>
          </Tabs.Content>
        </Tabs.Root>
      </Stack>
    );
  })();

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

      <Container maxW="5xl" position="relative" zIndex={1}>
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
              必要な情報だけに絞った4画面フローで、入力から結果確認まで進めます。
            </Text>
          </Stack>

          {viewMode !== "auth" ? (
            <HStack justify="space-between" flexWrap="wrap" gap={3}>
              <Badge colorPalette="teal" variant="subtle">
                {STEP_ITEMS[currentStepIndex].label}
              </Badge>

              <HStack gap={2}>
                <Avatar.Root size="xs">
                  {signedInUser?.image ? (
                    <Avatar.Image
                      src={signedInUser.image}
                      alt={signedInUser.name}
                    />
                  ) : null}
                  <Avatar.Fallback>
                    {toInitials(signedInUser?.name)}
                  </Avatar.Fallback>
                </Avatar.Root>
                <Text fontSize="sm" color="fg.muted">
                  {signedInUser?.email ?? "未ログイン"}
                </Text>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void handleSignOut()}
                  loading={isSignOutRunning}
                >
                  ログアウト
                </Button>
              </HStack>
            </HStack>
          ) : null}

          <HStack gap={2} flexWrap="wrap">
            {STEP_ITEMS.map((item, index) => (
              <Badge
                key={item.label}
                variant={index <= currentStepIndex ? "solid" : "outline"}
                colorPalette={index <= currentStepIndex ? "teal" : "gray"}
              >
                {index + 1}. {item.label}
              </Badge>
            ))}
          </HStack>

          <Card.Root
            bg="var(--app-surface)"
            borderColor="var(--app-border)"
            borderWidth="1px"
            borderRadius="2xl"
            className={`flow-card flow-card--${transitionDirection}`}
          >
            <Card.Body>{screenBody}</Card.Body>
          </Card.Root>
        </Stack>
      </Container>
    </Box>
  );
}
