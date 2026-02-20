"use client";

import {
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
  Progress,
  ProgressCircle,
  Separator,
  SimpleGrid,
  Stack,
  Stat,
  Steps,
  Tabs,
  Text,
  Textarea,
  Timeline,
} from "@chakra-ui/react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
type FlowScreen = 0 | 1 | 2 | 3;
type TransitionDirection = "forward" | "backward";

type FlowScreenMeta = {
  title: string;
  description: string;
};

const CALENDAR_REAUTH_MARKER = "REAUTH_REQUIRED_CALENDAR_SCOPE:";
const DEFAULT_USER_TIMEZONE = "Asia/Tokyo";
const FLOW_SCREENS: FlowScreenMeta[] = [
  {
    title: "認証",
    description: "Googleログインと権限付与",
  },
  {
    title: "入力",
    description: "タスクと条件を設定",
  },
  {
    title: "実行",
    description: "Workflow の進行を確認",
  },
  {
    title: "結果",
    description: "分解結果と履歴を確認",
  },
];
const WORKFLOW_TIMELINE = [
  {
    title: "Googleログイン",
    description: "Calendar連携に必要な権限を許可",
  },
  {
    title: "タスク細分化",
    description: "Workers AIで実行可能なステップへ分解",
  },
  {
    title: "カレンダー反映",
    description: "Google Calendarへ予定を自動作成",
  },
  {
    title: "保存と表示",
    description: "D1保存後に結果画面へ反映",
  },
] as const;

function clampFlowScreen(value: number): FlowScreen {
  if (value <= 0) {
    return 0;
  }
  if (value >= FLOW_SCREENS.length - 1) {
    return 3;
  }
  return value as FlowScreen;
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

  const [activeScreen, setActiveScreen] = useState<FlowScreen>(0);
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>("forward");
  const [resultTab, setResultTab] = useState<"result" | "history">("result");

  const previousPhaseRef = useRef<RunPhase>("idle");
  const activeScreenRef = useRef<FlowScreen>(0);

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
  const workflowProgress = useMemo(
    () => toWorkflowProgress(phase, record, workflowStatus),
    [phase, record, workflowStatus],
  );

  useEffect(() => {
    activeScreenRef.current = activeScreen;
  }, [activeScreen]);

  const moveToScreen = useCallback((next: FlowScreen) => {
    const previous = activeScreenRef.current;
    if (previous === next) {
      return;
    }

    setTransitionDirection(next > previous ? "forward" : "backward");
    setActiveScreen(next);
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
    const timer = window.setInterval(() => {
      void poll();
    }, 2500);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [workflowId, phase, refreshHistory]);

  useEffect(() => {
    if (!signedInUser) {
      moveToScreen(0);
      previousPhaseRef.current = phase;
      return;
    }

    if (activeScreenRef.current === 0) {
      moveToScreen(1);
    }

    const previous = previousPhaseRef.current;
    if ((phase === "starting" || phase === "waiting") && previous !== phase) {
      moveToScreen(2);
    }

    if ((phase === "completed" || phase === "failed") && previous !== phase) {
      moveToScreen(3);
      setResultTab("result");
    }

    previousPhaseRef.current = phase;
  }, [signedInUser, phase, moveToScreen]);

  const isScreenAvailable = useCallback(
    (screen: FlowScreen): boolean => {
      if (screen === 0) {
        return true;
      }

      if (!signedInUser) {
        return false;
      }

      if (screen === 1) {
        return true;
      }

      if (screen === 2) {
        return Boolean(workflowId || record || phase !== "idle");
      }

      return Boolean(record || history.length > 0 || phase !== "idle");
    },
    [history.length, phase, record, signedInUser, workflowId],
  );

  const previousAvailableScreen = useMemo(() => {
    for (let index = activeScreen - 1; index >= 0; index -= 1) {
      const candidate = clampFlowScreen(index);
      if (isScreenAvailable(candidate)) {
        return candidate;
      }
    }

    return null;
  }, [activeScreen, isScreenAvailable]);

  const nextAvailableScreen = useMemo(() => {
    for (
      let index = activeScreen + 1;
      index < FLOW_SCREENS.length;
      index += 1
    ) {
      const candidate = clampFlowScreen(index);
      if (isScreenAvailable(candidate)) {
        return candidate;
      }
    }

    return null;
  }, [activeScreen, isScreenAvailable]);

  const handleStepChange = (step: number) => {
    const next = clampFlowScreen(step);
    if (!isScreenAvailable(next)) {
      return;
    }

    moveToScreen(next);
  };

  const handleSubmit = async (event: FormEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!signedInUser) {
      setErrorMessage(
        "実行にはログインが必要です。Google でログインしてください。",
      );
      moveToScreen(0);
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
    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? DEFAULT_USER_TIMEZONE;

    setPhase("starting");
    setErrorMessage(null);
    moveToScreen(2);

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
        moveToScreen(3);
      } else if (response.record?.status === "failed") {
        setPhase("failed");
        setErrorMessage(
          response.record.errorMessage ?? "Workflow が失敗しました。",
        );
        moveToScreen(3);
      } else {
        setPhase("waiting");
      }

      await refreshHistory();
    } catch (error) {
      setPhase("failed");
      setErrorMessage(toErrorMessage(error, "start"));
      moveToScreen(3);
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
      moveToScreen(3);
      return;
    }

    if (item.status === "failed") {
      setPhase("failed");
      setErrorMessage(item.errorMessage ?? "Workflow が失敗しました。");
      moveToScreen(3);
      return;
    }

    setPhase("waiting");
    moveToScreen(2);
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

  const screenBody = (() => {
    if (activeScreen === 0) {
      return (
        <Stack gap={6}>
          <Text color="fg.muted" fontSize="sm">
            この画面で認証を完了すると、タスク分解からGoogle Calendar反映までを
            ワンフローで実行できます。
          </Text>

          <SimpleGrid columns={{ base: 1, lg: 2 }} gap={4}>
            <Card.Root variant="outline" bg="var(--app-surface-soft)">
              <Card.Header pb={2}>
                <Card.Title fontSize="md">実行フロー</Card.Title>
                <Card.Description>
                  認証後は次の順で処理が進行します
                </Card.Description>
              </Card.Header>
              <Card.Body>
                <Timeline.Root>
                  {WORKFLOW_TIMELINE.map((item, index) => (
                    <Timeline.Item key={item.title}>
                      <Timeline.Separator>
                        <Timeline.Indicator>{index + 1}</Timeline.Indicator>
                        {index < WORKFLOW_TIMELINE.length - 1 ? (
                          <Timeline.Connector />
                        ) : null}
                      </Timeline.Separator>
                      <Timeline.Content>
                        <Timeline.Title>{item.title}</Timeline.Title>
                        <Timeline.Description>
                          {item.description}
                        </Timeline.Description>
                      </Timeline.Content>
                    </Timeline.Item>
                  ))}
                </Timeline.Root>
              </Card.Body>
            </Card.Root>

            <Card.Root variant="outline" bg="var(--app-surface-soft)">
              <Card.Header pb={2}>
                <Card.Title fontSize="md">現在の状態</Card.Title>
                <Card.Description>
                  ログイン状態と実行対象の概要
                </Card.Description>
              </Card.Header>
              <Card.Body>
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                  <Stat.Root>
                    <Stat.Label>セッション</Stat.Label>
                    <Stat.ValueText>
                      {isSessionLoading
                        ? "確認中"
                        : signedInUser
                          ? "ログイン済み"
                          : "未ログイン"}
                    </Stat.ValueText>
                    <Stat.HelpText>
                      {signedInUser
                        ? signedInUser.email
                        : "Googleログインが必要です"}
                    </Stat.HelpText>
                  </Stat.Root>
                  <Stat.Root>
                    <Stat.Label>最終ステータス</Stat.Label>
                    <Stat.ValueText>{statusLabel}</Stat.ValueText>
                    <Stat.HelpText>
                      {workflowId ? `Workflow: ${workflowId}` : "未実行"}
                    </Stat.HelpText>
                  </Stat.Root>
                </SimpleGrid>
              </Card.Body>
            </Card.Root>
          </SimpleGrid>

          <AuthPanel />

          <HStack justify="end">
            <Button
              colorPalette="teal"
              variant="outline"
              onClick={() => moveToScreen(1)}
              disabled={!signedInUser}
            >
              タスク入力へ進む
            </Button>
          </HStack>
        </Stack>
      );
    }

    if (activeScreen === 1) {
      return (
        <Box as="form" onSubmit={handleSubmit}>
          <Stack gap={5}>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
              <Card.Root variant="subtle" bg="var(--app-surface-soft)">
                <Card.Body py={4}>
                  <Stat.Root>
                    <Stat.Label>タイムゾーン</Stat.Label>
                    <Stat.ValueText fontSize="md">
                      {Intl.DateTimeFormat().resolvedOptions().timeZone ??
                        DEFAULT_USER_TIMEZONE}
                    </Stat.ValueText>
                  </Stat.Root>
                </Card.Body>
              </Card.Root>

              <Card.Root variant="subtle" bg="var(--app-surface-soft)">
                <Card.Body py={4}>
                  <Stat.Root>
                    <Stat.Label>最大ステップ</Stat.Label>
                    <Stat.ValueText fontSize="md">{maxSteps}</Stat.ValueText>
                  </Stat.Root>
                </Card.Body>
              </Card.Root>

              <Card.Root variant="subtle" bg="var(--app-surface-soft)">
                <Card.Body py={4}>
                  <Stat.Root>
                    <Stat.Label>実行状態</Stat.Label>
                    <Stat.ValueText fontSize="md">{statusLabel}</Stat.ValueText>
                  </Stat.Root>
                </Card.Body>
              </Card.Root>
            </SimpleGrid>

            <Field.Root required>
              <Field.Label>細分化したいタスク</Field.Label>
              <Textarea
                value={task}
                onChange={(event) => setTask(event.target.value)}
                placeholder="例: ハッカソン発表までに、プロトタイプを提出可能な状態にする"
                minH="140px"
              />
              <Field.HelperText>
                締切・提出形式・評価基準など、判定条件があれば本文に含めてください。
              </Field.HelperText>
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

            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
              <Field.Root>
                <Field.Label>最終期限（任意）</Field.Label>
                <Input
                  type="datetime-local"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                />
                <Field.HelperText>
                  未入力でも、タスク本文と補足から期限を推測して分解します。
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>最大ステップ数</Field.Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={maxSteps}
                  onChange={(event) => setMaxSteps(event.target.value)}
                />
              </Field.Root>
            </SimpleGrid>

            {workflowId ? (
              <Text fontSize="xs" color="fg.muted">
                最新 Workflow ID: {workflowId}
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

            <HStack gap={3} justify="space-between" flexWrap="wrap">
              <Text fontSize="sm" color="fg.muted">
                {signedInUser
                  ? `ログイン中: ${signedInUser.email}`
                  : "ログインすると実行できます"}
              </Text>
              <HStack gap={2}>
                <Button
                  variant="outline"
                  onClick={() => moveToScreen(2)}
                  disabled={!workflowId && phase === "idle"}
                >
                  実行状況を見る
                </Button>
                <Button
                  colorPalette="teal"
                  type="submit"
                  loading={phase === "starting"}
                  disabled={phase === "waiting" || isSessionLoading}
                >
                  {phase === "waiting" ? "実行中" : "細分化を開始"}
                </Button>
              </HStack>
            </HStack>
          </Stack>
        </Box>
      );
    }

    if (activeScreen === 2) {
      return (
        <Stack gap={5}>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
            <Card.Root variant="outline" bg="var(--app-surface-soft)">
              <Card.Body>
                <Stack align="center" textAlign="center" gap={4}>
                  <ProgressCircle.Root
                    value={workflowProgress}
                    colorPalette={phase === "failed" ? "red" : "teal"}
                    size="lg"
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
                    <Text fontSize="sm" color="fg.muted">
                      ステータスを定期確認し、D1保存後に結果へ切り替えます。
                    </Text>
                  </Stack>

                  <HStack gap={2} flexWrap="wrap" justify="center">
                    <Badge colorPalette="blue">
                      runtime: {workflowStatus?.status ?? "running"}
                    </Badge>
                    <Badge colorPalette="teal">
                      record: {record?.status ?? "running"}
                    </Badge>
                  </HStack>
                </Stack>
              </Card.Body>
            </Card.Root>

            <Card.Root variant="outline" bg="var(--app-surface-soft)">
              <Card.Header pb={2}>
                <Card.Title fontSize="md">進行チェックポイント</Card.Title>
              </Card.Header>
              <Card.Body>
                <Timeline.Root>
                  {[
                    { key: "queued", label: "キュー投入" },
                    { key: "running", label: "AIで細分化" },
                    { key: "calendar_syncing", label: "カレンダー反映" },
                    { key: "completed", label: "保存完了" },
                  ].map((item, index) => {
                    const currentStatus = record?.status;
                    const isCurrent = currentStatus === item.key;
                    const isDone =
                      item.key === "queued"
                        ? Boolean(currentStatus)
                        : item.key === "running"
                          ? currentStatus === "running" ||
                            currentStatus === "calendar_syncing" ||
                            currentStatus === "completed"
                          : item.key === "calendar_syncing"
                            ? currentStatus === "calendar_syncing" ||
                              currentStatus === "completed"
                            : currentStatus === "completed";

                    return (
                      <Timeline.Item key={item.key}>
                        <Timeline.Separator>
                          <Timeline.Indicator
                            bg={
                              isCurrent
                                ? "teal.solid"
                                : isDone
                                  ? "teal.subtle"
                                  : "bg.subtle"
                            }
                            color={isCurrent ? "white" : "fg"}
                          >
                            {index + 1}
                          </Timeline.Indicator>
                          {index < 3 ? <Timeline.Connector /> : null}
                        </Timeline.Separator>
                        <Timeline.Content>
                          <Timeline.Title>{item.label}</Timeline.Title>
                          <Timeline.Description>
                            {isCurrent ? "実行中" : isDone ? "完了" : "待機"}
                          </Timeline.Description>
                        </Timeline.Content>
                      </Timeline.Item>
                    );
                  })}
                </Timeline.Root>
              </Card.Body>
            </Card.Root>
          </SimpleGrid>

          <Progress.Root
            value={workflowProgress}
            colorPalette={phase === "failed" ? "red" : "teal"}
            size="lg"
            borderRadius="full"
          >
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>

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
                再認可後に再実行してください。
              </Text>
            </HStack>
          ) : null}

          <HStack justify="space-between" flexWrap="wrap">
            <Text fontSize="xs" color="fg.muted">
              {workflowId ? `Workflow ID: ${workflowId}` : "Workflow未開始"}
            </Text>
            <Button variant="outline" onClick={() => moveToScreen(3)}>
              結果画面へ
            </Button>
          </HStack>
        </Stack>
      );
    }

    return (
      <Tabs.Root
        value={resultTab}
        onValueChange={(details) => {
          if (details.value === "result" || details.value === "history") {
            setResultTab(details.value);
          }
        }}
      >
        <Tabs.List mb={4}>
          <Tabs.Trigger value="result">分解結果</Tabs.Trigger>
          <Tabs.Trigger value="history">実行履歴</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="result">
          {breakdown ? (
            <Stack gap={5}>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                <Card.Root variant="outline" bg="var(--app-surface-soft)">
                  <Card.Header pb={2}>
                    <Card.Title fontSize="md">目標</Card.Title>
                  </Card.Header>
                  <Card.Body pt={0}>
                    <Text color="fg.muted">{breakdown.goal}</Text>
                  </Card.Body>
                </Card.Root>

                <Card.Root variant="outline" bg="var(--app-surface-soft)">
                  <Card.Header pb={2}>
                    <Card.Title fontSize="md">要約</Card.Title>
                  </Card.Header>
                  <Card.Body pt={0}>
                    <Text color="fg.muted">{breakdown.summary}</Text>
                  </Card.Body>
                </Card.Root>
              </SimpleGrid>

              <Card.Root variant="outline" bg="var(--app-surface-soft)">
                <Card.Header pb={2}>
                  <Card.Title fontSize="md">サブタスク</Card.Title>
                  <Card.Description>
                    期限順に並べた実行ステップ
                  </Card.Description>
                </Card.Header>
                <Card.Body>
                  <Timeline.Root>
                    {breakdown.subtasks.map((subtask, index) => (
                      <Timeline.Item key={`${subtask.title}-${subtask.dueAt}`}>
                        <Timeline.Separator>
                          <Timeline.Indicator>{index + 1}</Timeline.Indicator>
                          {index < breakdown.subtasks.length - 1 ? (
                            <Timeline.Connector />
                          ) : null}
                        </Timeline.Separator>
                        <Timeline.Content>
                          <Timeline.Title>{subtask.title}</Timeline.Title>
                          <Timeline.Description>
                            <Stack gap={1}>
                              <Text>{subtask.description}</Text>
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
                          </Timeline.Description>
                        </Timeline.Content>
                      </Timeline.Item>
                    ))}
                  </Timeline.Root>
                </Card.Body>
              </Card.Root>

              {calendarResult ? (
                <Card.Root variant="outline" bg="var(--app-surface-soft)">
                  <Card.Header pb={2}>
                    <Card.Title fontSize="md">
                      Google Calendar 反映結果
                    </Card.Title>
                    <Card.Description>
                      作成された予定 ({calendarResult.createdEvents.length} 件)
                    </Card.Description>
                  </Card.Header>
                  <Card.Body>
                    <List.Root gap={3}>
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
                  まだ分解結果はありません。タスクを実行するとここに表示されます。
                </Text>
              </Card.Body>
            </Card.Root>
          )}
        </Tabs.Content>

        <Tabs.Content value="history">
          <Card.Root variant="outline" bg="var(--app-surface-soft)">
            <Card.Header pb={2}>
              <HStack justify="space-between" flexWrap="wrap">
                <Card.Title fontSize="md">最近の実行履歴</Card.Title>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void refreshHistory()}
                >
                  更新
                </Button>
              </HStack>
            </Card.Header>
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
            </Card.Body>
          </Card.Root>
        </Tabs.Content>
      </Tabs.Root>
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
      <Box className="app-orb app-orb--one" />
      <Box className="app-orb app-orb--two" />

      <Container maxW="6xl" position="relative" zIndex={1}>
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
              1画面ずつ進めるステップ形式で、入力から反映までを見える化します。
            </Text>
          </Stack>

          <Card.Root
            bg="var(--app-surface)"
            borderColor="var(--app-border)"
            borderWidth="1px"
            borderRadius="2xl"
            className={`flow-card flow-card--${transitionDirection}`}
          >
            <Card.Header pb={4}>
              <Stack gap={4}>
                <Steps.Root
                  count={FLOW_SCREENS.length}
                  step={activeScreen}
                  linear={false}
                  onStepChange={(details) => handleStepChange(details.step)}
                >
                  <Steps.List>
                    {FLOW_SCREENS.map((item, index) => {
                      const screenIndex = clampFlowScreen(index);
                      const disabled = !isScreenAvailable(screenIndex);

                      return (
                        <Steps.Item index={index} key={item.title} flex="1">
                          <Steps.Trigger
                            disabled={disabled}
                            px={2}
                            py={1.5}
                            rounded="lg"
                            _hover={{
                              bg: disabled ? undefined : "blackAlpha.50",
                            }}
                            _disabled={{
                              opacity: 0.4,
                              cursor: "not-allowed",
                            }}
                          >
                            <HStack align="start" gap={3}>
                              <Steps.Indicator>
                                <Steps.Status
                                  complete={<Text fontWeight="bold">✓</Text>}
                                  incomplete={<Steps.Number />}
                                  current={<Steps.Number />}
                                />
                              </Steps.Indicator>
                              <Stack gap={0} align="start">
                                <Steps.Title fontSize="sm">
                                  {item.title}
                                </Steps.Title>
                                <Steps.Description
                                  fontSize="xs"
                                  color="fg.muted"
                                >
                                  {item.description}
                                </Steps.Description>
                              </Stack>
                            </HStack>
                          </Steps.Trigger>
                          {index < FLOW_SCREENS.length - 1 ? (
                            <Steps.Separator />
                          ) : null}
                        </Steps.Item>
                      );
                    })}
                  </Steps.List>
                </Steps.Root>

                <Separator />

                <HStack justify="space-between" flexWrap="wrap" gap={3}>
                  <Stack gap={0}>
                    <Text fontSize="sm" color="fg.muted">
                      現在の画面
                    </Text>
                    <Heading size="md">
                      {FLOW_SCREENS[activeScreen].title}
                    </Heading>
                  </Stack>
                  <HStack gap={2}>
                    <Badge
                      colorPalette={phase === "failed" ? "red" : "teal"}
                      variant="subtle"
                    >
                      {statusLabel}
                    </Badge>
                    <Badge colorPalette="gray" variant="subtle">
                      step {activeScreen + 1}/{FLOW_SCREENS.length}
                    </Badge>
                  </HStack>
                </HStack>
              </Stack>
            </Card.Header>

            <Card.Body pt={0}>{screenBody}</Card.Body>

            <Card.Footer pt={2}>
              <HStack justify="space-between" w="full">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (previousAvailableScreen !== null) {
                      moveToScreen(previousAvailableScreen);
                    }
                  }}
                  disabled={previousAvailableScreen === null}
                >
                  前の画面
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (nextAvailableScreen !== null) {
                      moveToScreen(nextAvailableScreen);
                    }
                  }}
                  disabled={nextAvailableScreen === null}
                >
                  次の画面
                </Button>
              </HStack>
            </Card.Footer>
          </Card.Root>
        </Stack>
      </Container>
    </Box>
  );
}
