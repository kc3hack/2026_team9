import type { TaskDecomposeResult } from "./task-decompose.types";

export type TaskWorkflowStatus =
  | "queued"
  | "running"
  | "calendar_syncing"
  | "completed"
  | "failed";

export type CalendarCreatedEvent = {
  id: string;
  htmlLink: string | null;
  status: string | null;
  summary: string;
  subtaskTitle: string;
  startAt: string;
  endAt: string;
};

export type CalendarSyncResult = {
  calendarId: string;
  timezone: string;
  createdEvents: CalendarCreatedEvent[];
};

export type TaskWorkflowRecord = {
  workflowId: string;
  userId: string;
  status: TaskWorkflowStatus;
  taskInput: string;
  context: string | null;
  deadline: string | null;
  timezone: string | null;
  llmOutput: TaskDecomposeResult | null;
  calendarOutput: CalendarSyncResult | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type TaskWorkflowPersistInput = {
  workflowId: string;
  userId: string;
  status: TaskWorkflowStatus;
  taskInput: string;
  context?: string;
  deadline?: string;
  timezone?: string;
  llmOutput?: TaskDecomposeResult | null;
  calendarOutput?: CalendarSyncResult | null;
  errorMessage?: string | null;
  completedAt?: string | null;
};
