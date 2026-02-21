"use client";

import {
  Badge,
  Button,
  Card,
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
import { AuthPanel } from "@/components/auth/auth-panel";
import type { SessionResponse } from "@/lib/auth-api";
import type { WorkflowRecord } from "@/lib/task-workflow-api";
import {
  formatDateTime,
  toHistoryTitle,
  toStatusLabelFromRecord,
} from "../helpers";
import type { ResultTab, RunPhase } from "../types";

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
  history: WorkflowRecord[];
  onSelectHistory: (item: WorkflowRecord) => void;
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
  resultTab: ResultTab;
  onResultTabChange: (tab: ResultTab) => void;
  record: WorkflowRecord | null;
  history: WorkflowRecord[];
  displayErrorMessage: string | null;
  onStartNewTask: () => void;
  onSelectHistory: (item: WorkflowRecord) => void;
};

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
  history,
  onSelectHistory,
}: ComposeStepProps) {
  return (
    <Stack gap={5}>
      <form onSubmit={onSubmit}>
        <Stack gap={4}>
          <Field.Root required>
            <Field.Label>細分化したいタスク</Field.Label>
            <Textarea
              value={task}
              onChange={(event) => onTaskChange(event.target.value)}
              placeholder="例: ハッカソン発表までに、プロトタイプを提出可能な状態にする"
              minH="140px"
            />
          </Field.Root>

          <Field.Root>
            <Field.Label>補足コンテキスト（任意）</Field.Label>
            <Textarea
              value={context}
              onChange={(event) => onContextChange(event.target.value)}
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
                onChange={(event) => onDeadlineChange(event.target.value)}
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
                        {toHistoryTitle(item)}
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        {formatDateTime(item.createdAt, item.timezone)} /{" "}
                        {toStatusLabelFromRecord(item.status)}
                      </Text>
                    </Stack>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => onSelectHistory(item)}
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
  resultTab,
  onResultTabChange,
  record,
  history,
  displayErrorMessage,
  onStartNewTask,
  onSelectHistory,
}: ResultStepProps) {
  const breakdown = record?.llmOutput;
  const calendarResult = record?.calendarOutput;

  return (
    <Stack gap={5}>
      <HStack justify="space-between" flexWrap="wrap" gap={3}>
        <Badge colorPalette={phase === "failed" ? "red" : "green"}>
          {statusLabel}
        </Badge>
        <Button variant="outline" onClick={onStartNewTask}>
          新しいタスクを入力
        </Button>
      </HStack>

      <Tabs.Root
        value={resultTab}
        onValueChange={(details) => {
          if (details.value === "result" || details.value === "history") {
            onResultTabChange(details.value);
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
                          <Text fontWeight="medium">
                            {toHistoryTitle(item)}
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            {formatDateTime(item.createdAt, item.timezone)} /{" "}
                            {toStatusLabelFromRecord(item.status)}
                          </Text>
                        </Stack>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => onSelectHistory(item)}
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
}
