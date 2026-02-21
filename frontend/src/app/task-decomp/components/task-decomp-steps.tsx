"use client";

import {
  Badge,
  Box,
  Button,
  Field,
  Heading,
  HStack,
  Input,
  List,
  ProgressCircle,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type { FormEvent } from "react";
import { AuthPanel } from "@/components/auth/auth-panel";
import type { SessionResponse } from "@/lib/auth-api";
import type { WorkflowRecord } from "@/lib/task-workflow-api";
import { formatDateTime } from "../helpers";
import type { RunPhase } from "../types";

type AuthStepProps = {
  onSessionChanged: (nextSession: SessionResponse) => void;
};

type ComposeStepProps = {
  task: string;
  context: string;
  deadline: string;
  maxSteps: string;
  onTaskChange: (value: string) => void;
  onContextChange: (value: string) => void;
  onDeadlineChange: (value: string) => void;
  onMaxStepsChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  displayErrorMessage: string | null;
  requiresCalendarReauth: boolean;
  onCalendarReauth: () => void;
  isReauthRunning: boolean;
  phase: RunPhase;
  isSessionLoading: boolean;
};

type RunningStepProps = {
  workflowProgress: number;
  phase: RunPhase;
  waitingDots: string;
  statusLabel: string;
  displayErrorMessage: string | null;
  requiresCalendarReauth: boolean;
  onCalendarReauth: () => void;
  isReauthRunning: boolean;
};

type ResultStepProps = {
  phase: RunPhase;
  statusLabel: string;
  record: WorkflowRecord | null;
  userTimezone: string;
  displayErrorMessage: string | null;
  onStartNewTask: () => void;
};

type StatusCardProps = {
  phase: RunPhase;
  statusLabel: string;
};

function toStatusCardTone(phase: RunPhase): {
  caption: string;
  dotColor: string;
} {
  if (phase === "failed") {
    return {
      caption: "実行エラー",
      dotColor: "red.400",
    };
  }

  if (phase === "completed") {
    return {
      caption: "実行完了",
      dotColor: "green.400",
    };
  }

  if (phase === "starting" || phase === "waiting") {
    return {
      caption: "実行中",
      dotColor: "teal.400",
    };
  }

  return {
    caption: "待機中",
    dotColor: "gray.400",
  };
}

function StatusCard({ phase, statusLabel }: StatusCardProps) {
  const tone = toStatusCardTone(phase);

  return (
    <Box
      borderWidth="1px"
      borderColor="var(--app-border)"
      bg="var(--app-surface-soft)"
      borderRadius="lg"
      px={{ base: 3, md: 3.5 }}
      py={{ base: 2, md: 2.5 }}
      w="fit-content"
      maxW="100%"
      title={statusLabel}
    >
      <HStack gap={1.5}>
        <Box w={2} h={2} borderRadius="full" bg={tone.dotColor} />
        <Text fontSize="xs" color="fg.muted">
          {tone.caption}
        </Text>
      </HStack>
    </Box>
  );
}

export function AuthStep({ onSessionChanged }: AuthStepProps) {
  return (
    <Stack gap={5}>
      <Text color="fg.muted" fontSize="sm">
        まずGoogleでログインし、カレンダー連携権限を許可してください。
        認証後はタスク入力画面に進みます。
      </Text>
      <AuthPanel onSessionChanged={onSessionChanged} />
    </Stack>
  );
}

export function ComposeStep({
  task,
  context,
  deadline,
  maxSteps,
  onTaskChange,
  onContextChange,
  onDeadlineChange,
  onMaxStepsChange,
  onSubmit,
  displayErrorMessage,
  requiresCalendarReauth,
  onCalendarReauth,
  isReauthRunning,
  phase,
  isSessionLoading,
}: ComposeStepProps) {
  return (
    <Stack gap={5}>
      <Box
        borderWidth="1px"
        borderColor="var(--app-border)"
        bg="var(--app-surface-soft)"
        borderRadius="xl"
        p={3}
      >
        <Stack gap={2}>
          <Text fontSize="sm" fontWeight="semibold">
            この画面で実行される処理
          </Text>
          <List.Root gap={1} ps={4}>
            <List.Item fontSize="sm" color="fg.muted">
              入力タスクを Workers AI で細分化します
            </List.Item>
            <List.Item fontSize="sm" color="fg.muted">
              細分化結果を Google Calendar へ予定として追加します
            </List.Item>
            <List.Item fontSize="sm" color="fg.muted">
              実行結果を D1 に保存し、画面へ反映します
            </List.Item>
          </List.Root>
          <Text fontSize="xs" color="fg.muted">
            Google Calendar は連携済みです。権限エラーが出た場合は
            「Google権限を再認可」から再ログインしてください。
          </Text>
        </Stack>
      </Box>

      <form onSubmit={onSubmit}>
        <Stack gap={4}>
          <Field.Root required>
            <Field.Label>細分化したいタスク</Field.Label>
            <Textarea
              value={task}
              onChange={(event) => onTaskChange(event.target.value)}
              placeholder="例: ハッカソン発表までに、プロトタイプを提出可能な状態にする"
              minH="140px"
              bg="var(--app-surface-soft)"
              borderColor="var(--app-border)"
            />
          </Field.Root>

          <Field.Root>
            <Field.Label>補足コンテキスト（任意）</Field.Label>
            <Textarea
              value={context}
              onChange={(event) => onContextChange(event.target.value)}
              placeholder="例: 3人チーム、担当はフロント中心、毎日21時以降に作業"
              minH="96px"
              bg="var(--app-surface-soft)"
              borderColor="var(--app-border)"
            />
          </Field.Root>

          <HStack align="start" gap={4} flexWrap="wrap">
            <Field.Root flex="1" minW={{ base: "100%", md: "260px" }}>
              <Field.Label>最終期限（任意）</Field.Label>
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(event) => onDeadlineChange(event.target.value)}
                bg="var(--app-surface-soft)"
                borderColor="var(--app-border)"
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
                onChange={(event) => onMaxStepsChange(event.target.value)}
                bg="var(--app-surface-soft)"
                borderColor="var(--app-border)"
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
                onClick={onCalendarReauth}
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
    </Stack>
  );
}

export function RunningStep({
  workflowProgress,
  phase,
  waitingDots,
  statusLabel,
  displayErrorMessage,
  requiresCalendarReauth,
  onCalendarReauth,
  isReauthRunning,
}: RunningStepProps) {
  return (
    <Stack align="center" textAlign="center" gap={5} py={{ base: 4, md: 8 }}>
      <ProgressCircle.Root
        value={workflowProgress}
        size="xl"
        colorPalette={phase === "failed" ? "red" : "teal"}
      >
        <ProgressCircle.Circle>
          <ProgressCircle.Track />
          <ProgressCircle.Range />
        </ProgressCircle.Circle>
        <ProgressCircle.ValueText>{workflowProgress}%</ProgressCircle.ValueText>
      </ProgressCircle.Root>

      <Stack gap={1}>
        <Heading size="md">ワークフロー実行中{waitingDots}</Heading>
        <Text color="fg.muted" fontSize="sm">
          完了したら自動で結果画面へ切り替わります。
        </Text>
      </Stack>

      <StatusCard phase={phase} statusLabel={statusLabel} />

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
          onClick={onCalendarReauth}
          loading={isReauthRunning}
        >
          Google権限を再認可
        </Button>
      ) : null}
    </Stack>
  );
}

export function ResultStep({
  phase,
  statusLabel,
  record,
  userTimezone,
  displayErrorMessage,
  onStartNewTask,
}: ResultStepProps) {
  const breakdown = record?.llmOutput;
  const calendarResult = record?.calendarOutput;
  const displayTimezone = record?.timezone ?? userTimezone;

  return (
    <Stack gap={5}>
      <HStack justify="space-between" align="start" flexWrap="wrap" gap={3}>
        <StatusCard phase={phase} statusLabel={statusLabel} />
        <Button variant="outline" onClick={onStartNewTask}>
          新しいタスクを入力
        </Button>
      </HStack>

      {breakdown ? (
        <Stack gap={5}>
          <Stack gap={2}>
            <Text fontSize="xs" color="fg.muted" fontWeight="semibold">
              目標
            </Text>
            <Text>{breakdown.goal}</Text>
            <Text fontSize="xs" color="fg.muted" fontWeight="semibold" pt={2}>
              要約
            </Text>
            <Text color="fg.muted">{breakdown.summary}</Text>
          </Stack>

          <Stack gap={3}>
            <HStack justify="space-between" flexWrap="wrap">
              <Text fontWeight="semibold">サブタスク</Text>
              <Badge colorPalette="teal" variant="subtle">
                {breakdown.subtasks.length} 件
              </Badge>
            </HStack>
            <List.Root gap={3}>
              {breakdown.subtasks.map((subtask, index) => (
                <List.Item key={`${index}-${subtask.title}`}>
                  <Box borderWidth="1px" borderRadius="xl" p={3}>
                    <Stack gap={1}>
                      <Text fontWeight="medium">{subtask.title}</Text>
                      <Text fontSize="sm" color="fg.muted">
                        {subtask.description}
                      </Text>
                      <HStack gap={2} flexWrap="wrap">
                        <Badge colorPalette="blue" variant="subtle">
                          期限: {formatDateTime(subtask.dueAt, displayTimezone)}
                        </Badge>
                        <Badge colorPalette="teal" variant="subtle">
                          {subtask.durationMinutes} 分
                        </Badge>
                      </HStack>
                    </Stack>
                  </Box>
                </List.Item>
              ))}
            </List.Root>
          </Stack>

          {calendarResult ? (
            <Stack gap={3}>
              <HStack justify="space-between" flexWrap="wrap">
                <Text fontWeight="semibold">Google Calendar 反映結果</Text>
                <Badge colorPalette="blue" variant="subtle">
                  {calendarResult.createdEvents.length} 件
                </Badge>
              </HStack>

              {calendarResult.createdEvents.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  作成された予定はありません。
                </Text>
              ) : (
                <List.Root gap={2}>
                  {calendarResult.createdEvents.map((eventItem) => (
                    <List.Item key={eventItem.id}>
                      <HStack justify="space-between" align="start" gap={3}>
                        <Stack gap={1}>
                          <Text fontWeight="medium">{eventItem.summary}</Text>
                          <Text fontSize="sm" color="fg.muted">
                            {formatDateTime(
                              eventItem.startAt,
                              calendarResult.timezone ?? displayTimezone,
                            )}{" "}
                            -{" "}
                            {formatDateTime(
                              eventItem.endAt,
                              calendarResult.timezone ?? displayTimezone,
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
              )}
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
      ) : (
        <Stack gap={2}>
          <Text fontSize="sm" color="fg.muted">
            結果がありません。失敗した場合は履歴から詳細を確認してください。
          </Text>
          {displayErrorMessage ? (
            <Text fontSize="sm" color="red.500">
              {displayErrorMessage}
            </Text>
          ) : null}
        </Stack>
      )}
    </Stack>
  );
}
