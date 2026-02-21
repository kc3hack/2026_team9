"use client";

export type TaskSubtask = {
  title: string;
  description: string;
  dueAt: string;
  durationMinutes: number;
};

export type TaskBreakdown = {
  goal: string;
  summary: string;
  subtasks: TaskSubtask[];
  assumptions: string[];
};

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

export type WorkflowRecord = {
  workflowId: string;
  userId: string;
  status: "queued" | "running" | "calendar_syncing" | "completed" | "failed";
  taskInput: string;
  context: string | null;
  deadline: string | null;
  timezone: string | null;
  llmOutput: TaskBreakdown | null;
  calendarOutput: CalendarSyncResult | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type WorkflowRuntimeStatus = {
  status:
    | "queued"
    | "running"
    | "paused"
    | "errored"
    | "terminated"
    | "complete"
    | "waiting"
    | "waitingForPause"
    | "unknown";
  error?: {
    name: string;
    message: string;
  };
  output?: unknown;
};

export type StartWorkflowRequest = {
  task: string;
  context?: string;
  deadline?: string;
  timezone?: string;
  maxSteps?: number;
};

export type WorkflowStatusResponse = {
  id: string;
  workflowStatus: WorkflowRuntimeStatus;
  record: WorkflowRecord | null;
};

export type WorkflowHistoryResponse = {
  items: WorkflowRecord[];
};

const defaultLocalApiBaseUrl = "http://localhost:8787";

export class TaskWorkflowApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TaskWorkflowApiError";
    this.status = status;
  }
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

function inferApiBaseUrlFromRuntime(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (isLocalHost(window.location.hostname)) {
    return defaultLocalApiBaseUrl;
  }

  return null;
}

function resolveApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (value && value.length > 0) {
    return value;
  }

  const inferred = inferApiBaseUrlFromRuntime();
  if (inferred && inferred.length > 0) {
    return inferred;
  }

  if (typeof window !== "undefined" && !isLocalHost(window.location.hostname)) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is required for non-local environments.",
    );
  }

  return defaultLocalApiBaseUrl;
}

function endpoint(path: string): string {
  return `${resolveApiBaseUrl()}${path}`;
}

async function toApiError(
  response: Response,
  fallbackMessage: string,
): Promise<TaskWorkflowApiError> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return new TaskWorkflowApiError(fallbackMessage, response.status);
  }

  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
    message?: unknown;
  } | null;

  const message =
    payload &&
    typeof payload.error === "string" &&
    payload.error.trim().length > 0
      ? payload.error
      : payload &&
          typeof payload.message === "string" &&
          payload.message.trim().length > 0
        ? payload.message
        : fallbackMessage;

  return new TaskWorkflowApiError(message, response.status);
}

export async function startTaskWorkflow(
  input: StartWorkflowRequest,
): Promise<WorkflowStatusResponse> {
  const response = await fetch(endpoint("/workflows/decompose"), {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await toApiError(
      response,
      `Failed to start workflow (${response.status}).`,
    );
  }

  return (await response.json()) as WorkflowStatusResponse;
}

export async function getTaskWorkflowStatus(
  workflowId: string,
): Promise<WorkflowStatusResponse> {
  const response = await fetch(
    endpoint(`/workflows/${encodeURIComponent(workflowId)}`),
    {
      method: "GET",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw await toApiError(
      response,
      `Failed to load workflow status (${response.status}).`,
    );
  }

  return (await response.json()) as WorkflowStatusResponse;
}

export async function getTaskWorkflowHistory(
  limit = 20,
): Promise<WorkflowHistoryResponse> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const response = await fetch(
    endpoint(`/workflows/history?limit=${safeLimit.toString()}`),
    {
      method: "GET",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw await toApiError(
      response,
      `Failed to load workflow history (${response.status}).`,
    );
  }

  return (await response.json()) as WorkflowHistoryResponse;
}
