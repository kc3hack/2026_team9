import { AuthApiError } from "@/lib/auth-api";
import {
  TaskWorkflowApiError,
  type WorkflowRecord,
  type WorkflowRuntimeStatus,
} from "@/lib/task-workflow-api";
import { CALENDAR_REAUTH_MARKER, DEFAULT_USER_TIMEZONE } from "./constants";
import type { ErrorAction, RunPhase, ViewMode } from "./types";

export function viewIndex(view: ViewMode): number {
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

export function toErrorMessage(error: unknown, action: ErrorAction): string {
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

export function needsCalendarReauth(rawMessage: string | null): boolean {
  return Boolean(rawMessage?.includes(CALENDAR_REAUTH_MARKER));
}

export function toDisplayErrorMessage(
  rawMessage: string | null,
): string | null {
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

export function formatDateTime(
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

export function toStatusLabel(
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

export function toStatusLabelFromRecord(
  status: WorkflowRecord["status"],
): string {
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

export function toHistoryTitle(record: WorkflowRecord): string {
  const goal = record.llmOutput?.goal?.trim();
  if (goal && goal.length > 0) {
    return goal;
  }

  const summary = record.llmOutput?.summary?.trim();
  if (summary && summary.length > 0) {
    return summary;
  }

  return record.taskInput;
}

export function toWorkflowProgress(
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

export function toDeadlineIso(value: string): string | undefined {
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

export function toInitials(name: string | null | undefined): string {
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
