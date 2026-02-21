"use client";

import {
  Avatar,
  Box,
  Button,
  Card,
  Container,
  Drawer,
  Heading,
  HStack,
  List,
  Portal,
  Stack,
  Steps,
  Text,
} from "@chakra-ui/react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import {
  AuthStep,
  ComposeStep,
  ResultStep,
  RunningStep,
} from "./components/task-decomp-steps";
import { DEFAULT_USER_TIMEZONE, STEP_ITEMS } from "./constants";
import {
  formatDateTime,
  needsCalendarReauth,
  toDeadlineIso,
  toDisplayErrorMessage,
  toErrorMessage,
  toHistoryTitle,
  toInitials,
  toStatusLabel,
  toStatusLabelFromRecord,
  toWorkflowProgress,
  viewIndex,
} from "./helpers";
import type {
  ResultTab,
  RunPhase,
  TransitionDirection,
  ViewMode,
} from "./types";

export default function TaskDecompPage() {
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
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [dotTick, setDotTick] = useState(0);

  const [resultTab, setResultTab] = useState<ResultTab>("result");
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
      setIsHistoryDrawerOpen(false);
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
  const handleOpenHistoryDrawer = () => {
    void refreshHistory();
    setIsHistoryDrawerOpen(true);
  };
  const handleSelectHistoryFromDrawer = (item: WorkflowRecord) => {
    setIsHistoryDrawerOpen(false);
    handleSelectHistory(item);
  };

  const screenBody = (() => {
    if (viewMode === "auth") {
      return <AuthStep onSessionChanged={handleAuthPanelSessionChanged} />;
    }

    if (viewMode === "compose") {
      return (
        <ComposeStep
          task={task}
          context={context}
          deadline={deadline}
          maxSteps={maxSteps}
          onTaskChange={setTask}
          onContextChange={setContext}
          onDeadlineChange={setDeadline}
          onMaxStepsChange={setMaxSteps}
          onSubmit={handleSubmit}
          displayErrorMessage={displayErrorMessage}
          requiresCalendarReauth={requiresCalendarReauth}
          onCalendarReauth={() => void handleCalendarReauth()}
          isReauthRunning={isReauthRunning}
          phase={phase}
          isSessionLoading={isSessionLoading}
        />
      );
    }

    if (viewMode === "running") {
      return (
        <RunningStep
          workflowProgress={workflowProgress}
          phase={phase}
          waitingDots={waitingDots}
          statusLabel={statusLabel}
          displayErrorMessage={displayErrorMessage}
          requiresCalendarReauth={requiresCalendarReauth}
          onCalendarReauth={() => void handleCalendarReauth()}
          isReauthRunning={isReauthRunning}
        />
      );
    }

    return (
      <ResultStep
        phase={phase}
        statusLabel={statusLabel}
        resultTab={resultTab}
        onResultTabChange={setResultTab}
        record={record}
        history={history}
        displayErrorMessage={displayErrorMessage}
        onStartNewTask={handleStartNewTask}
        onSelectHistory={handleSelectHistory}
      />
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
          <Stack gap={2}>
            <Heading size={{ base: "xl", md: "2xl" }} lineHeight="1.15">
              タスク細分化ワークフロー
            </Heading>
            <Text fontSize={{ base: "md", md: "lg" }} color="fg.muted">
              目標を今日の実行に落とし込むためのフローです。
            </Text>
          </Stack>

          <Stack gap={3}>
            <Steps.Root
              step={currentStepIndex}
              count={STEP_ITEMS.length}
              colorPalette="teal"
              size="sm"
              linear
            >
              <Steps.List>
                {STEP_ITEMS.map((item, index) => (
                  <Steps.Item key={item.label} index={index} flex="1">
                    <Steps.Trigger
                      disabled
                      px={{ base: 1, md: 2 }}
                      py={1}
                      justifyContent="center"
                      gap={2}
                    >
                      <Steps.Indicator />
                      <Steps.Title
                        fontSize={{ base: "xs", md: "sm" }}
                        display={{ base: "none", sm: "block" }}
                      >
                        {item.label}
                      </Steps.Title>
                    </Steps.Trigger>
                    {index < STEP_ITEMS.length - 1 ? <Steps.Separator /> : null}
                  </Steps.Item>
                ))}
              </Steps.List>
            </Steps.Root>

            {viewMode !== "auth" ? (
              <HStack justify="end" gap={2}>
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
                <Text
                  fontSize="sm"
                  color="fg.muted"
                  display={{ base: "none", md: "block" }}
                >
                  {signedInUser?.email ?? "未ログイン"}
                </Text>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={handleOpenHistoryDrawer}
                >
                  履歴
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void handleSignOut()}
                  loading={isSignOutRunning}
                >
                  ログアウト
                </Button>
              </HStack>
            ) : null}
          </Stack>

          {viewMode !== "auth" ? (
            <Drawer.Root
              open={isHistoryDrawerOpen}
              onOpenChange={(details) => setIsHistoryDrawerOpen(details.open)}
              placement={{ base: "bottom", md: "end" }}
              size={{ base: "full", md: "sm" }}
            >
              <Portal>
                <Drawer.Backdrop />
                <Drawer.Positioner>
                  <Drawer.Content>
                    <Drawer.Header>
                      <Drawer.Title>実行履歴</Drawer.Title>
                      <Drawer.Description>
                        過去のワークフローを選択して再表示できます。
                      </Drawer.Description>
                    </Drawer.Header>
                    <Drawer.Body>
                      {history.length === 0 ? (
                        <Text fontSize="sm" color="fg.muted">
                          まだ履歴はありません。
                        </Text>
                      ) : (
                        <List.Root gap={3}>
                          {history.map((item) => (
                            <List.Item key={item.workflowId}>
                              <HStack
                                justify="space-between"
                                align="start"
                                gap={3}
                              >
                                <Stack gap={0.5}>
                                  <Text fontWeight="medium" lineClamp={2}>
                                    {toHistoryTitle(item)}
                                  </Text>
                                  <Text fontSize="xs" color="fg.muted">
                                    {formatDateTime(
                                      item.createdAt,
                                      item.timezone,
                                    )}{" "}
                                    / {toStatusLabelFromRecord(item.status)}
                                  </Text>
                                </Stack>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() =>
                                    handleSelectHistoryFromDrawer(item)
                                  }
                                >
                                  表示
                                </Button>
                              </HStack>
                            </List.Item>
                          ))}
                        </List.Root>
                      )}
                    </Drawer.Body>
                    <Drawer.Footer>
                      <Drawer.CloseTrigger asChild>
                        <Button variant="outline">閉じる</Button>
                      </Drawer.CloseTrigger>
                    </Drawer.Footer>
                  </Drawer.Content>
                </Drawer.Positioner>
              </Portal>
            </Drawer.Root>
          ) : null}

          <Card.Root
            bg="var(--app-surface)"
            borderColor="var(--app-border)"
            borderWidth="1px"
            borderRadius="2xl"
            className={`flow-card flow-card--${transitionDirection}`}
          >
            <Card.Body p={{ base: 4, md: 6 }}>{screenBody}</Card.Body>
          </Card.Root>
        </Stack>
      </Container>
    </Box>
  );
}
