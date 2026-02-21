import type { TaskDecomposeRequest } from "./task-decompose.types";

const MAX_STEPS_LIMIT = 12;

function parseDeadline(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

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

function parseTimezone(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed;
}

function parseMaxSteps(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const rounded = Math.trunc(value);
  if (rounded < 1) {
    return 1;
  }

  return Math.min(rounded, MAX_STEPS_LIMIT);
}

export function toRequestPayload(input: unknown): TaskDecomposeRequest | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  if (
    typeof candidate.task !== "string" ||
    candidate.task.trim().length === 0
  ) {
    return null;
  }

  const context =
    typeof candidate.context === "string" && candidate.context.trim().length > 0
      ? candidate.context.trim()
      : undefined;
  const userId =
    typeof candidate.userId === "string" && candidate.userId.trim().length > 0
      ? candidate.userId.trim()
      : undefined;
  const deadline = parseDeadline(candidate.deadline);
  const timezone = parseTimezone(candidate.timezone);
  const maxSteps = parseMaxSteps(candidate.maxSteps);

  return {
    task: candidate.task.trim(),
    context,
    userId,
    deadline,
    timezone,
    maxSteps,
  };
}
