import type {
  TaskDecomposeRequest,
  TaskDecomposeResult,
  TaskSubtask,
} from "./task-decompose.types";
import { normalizeTaskTimezone } from "./task-timezone";

const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const DEFAULT_MAX_STEPS = 6;
const MIN_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 240;
const DEFAULT_INFERRED_DEADLINE_DAYS = 7;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function cleanAiText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return trimmed;
}

function toDate(value: string | undefined): Date | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function toIso(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function sanitizeDuration(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const rounded = Math.trunc(value);
  if (rounded < MIN_DURATION_MINUTES) {
    return MIN_DURATION_MINUTES;
  }

  return Math.min(rounded, MAX_DURATION_MINUTES);
}

function fallbackSummary(task: string): string {
  return `"${task}" を実行可能な単位へ分解した計画です。`;
}

function formatPromptDateInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      weekday: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function fallbackLabels(): Array<{ title: string; description: string }> {
  return [
    {
      title: "要件を明確化する",
      description: "成果物の定義、制約、評価基準を短く整理する。",
    },
    {
      title: "必要情報を収集する",
      description: "実装に必要な情報・資料・依存タスクを揃える。",
    },
    {
      title: "実装計画を組み立てる",
      description: "作業順序、担当、所要時間を決めて着手可能にする。",
    },
    {
      title: "実装を進める",
      description: "主要な作業を完了させ、未完了項目を洗い出す。",
    },
    {
      title: "検証と調整を行う",
      description: "結果を確認し、必要な修正を反映する。",
    },
    {
      title: "最終確認して提出する",
      description: "納品前チェックを行い、期限までに提出する。",
    },
  ];
}

function buildFallbackSubtasks(
  task: string,
  deadline: string | undefined,
  maxSteps: number,
): TaskSubtask[] {
  const labels = fallbackLabels();
  const count = Math.min(Math.max(maxSteps, 1), labels.length);
  const startAt = new Date();
  const parsedDeadline = toDate(deadline);
  const defaultHorizonMs = Math.max(count, 1) * 24 * 60 * 60 * 1000;
  const endAt =
    parsedDeadline && parsedDeadline.getTime() > startAt.getTime()
      ? parsedDeadline
      : new Date(startAt.getTime() + defaultHorizonMs);

  const spanMs = Math.max(
    endAt.getTime() - startAt.getTime(),
    count * 60 * 60 * 1000,
  );

  return labels.slice(0, count).map((label, index) => {
    const ratio = (index + 1) / count;
    const dueAt = new Date(startAt.getTime() + spanMs * ratio).toISOString();

    return {
      title: `${label.title} (${index + 1}/${count})`,
      description: `${label.description} 対象タスク: ${task}`,
      dueAt,
      durationMinutes: 60,
    };
  });
}

function normalizeSubtasks(
  rawSubtasks: unknown,
  fallback: TaskSubtask[],
  maxSteps: number,
): TaskSubtask[] {
  if (!Array.isArray(rawSubtasks)) {
    return fallback;
  }

  const normalized = rawSubtasks
    .slice(0, maxSteps)
    .map((entry, index) => {
      const fallbackStep = fallback[Math.min(index, fallback.length - 1)];

      if (typeof entry === "string") {
        const title = entry.trim();
        if (title.length === 0) {
          return null;
        }

        return {
          title,
          description: fallbackStep.description,
          dueAt: fallbackStep.dueAt,
          durationMinutes: fallbackStep.durationMinutes,
        } satisfies TaskSubtask;
      }

      if (!entry || typeof entry !== "object") {
        return null;
      }

      const candidate = entry as Record<string, unknown>;
      const title =
        typeof candidate.title === "string" && candidate.title.trim().length > 0
          ? candidate.title.trim()
          : fallbackStep.title;
      const description =
        typeof candidate.description === "string" &&
        candidate.description.trim().length > 0
          ? candidate.description.trim()
          : fallbackStep.description;

      return {
        title,
        description,
        dueAt: toIso(candidate.dueAt) ?? fallbackStep.dueAt,
        durationMinutes: sanitizeDuration(
          candidate.durationMinutes,
          fallbackStep.durationMinutes,
        ),
      } satisfies TaskSubtask;
    })
    .filter((item): item is TaskSubtask => item !== null)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeResult(
  candidate: Record<string, unknown>,
  payload: TaskDecomposeRequest,
): TaskDecomposeResult {
  const maxSteps = payload.maxSteps ?? DEFAULT_MAX_STEPS;
  const fallbackSubtasks = buildFallbackSubtasks(
    payload.task,
    payload.deadline,
    maxSteps,
  );

  const goal =
    typeof candidate.goal === "string" && candidate.goal.trim().length > 0
      ? candidate.goal.trim()
      : payload.task;

  const summary =
    typeof candidate.summary === "string" && candidate.summary.trim().length > 0
      ? candidate.summary.trim()
      : fallbackSummary(payload.task);

  const subtasks = normalizeSubtasks(
    candidate.subtasks,
    fallbackSubtasks,
    maxSteps,
  );

  return {
    goal,
    summary,
    subtasks,
    assumptions: asStringArray(candidate.assumptions),
  };
}

function createPrompt(payload: TaskDecomposeRequest): string {
  const maxSteps = payload.maxSteps ?? DEFAULT_MAX_STEPS;
  const planningTimezone = normalizeTaskTimezone(payload.timezone);
  const now = new Date();

  const deadlineGuidance = payload.deadline
    ? [
        `Final deadline (hard constraint): ${payload.deadline}`,
        "All subtask dueAt values must be on or before the final deadline.",
      ]
    : [
        "No explicit final deadline is provided.",
        "Infer a realistic final deadline from the task text/context when possible.",
        "Use explicit dates first; if not available, resolve relative terms against current date/time.",
        `If no clues exist, set a provisional final deadline to about ${DEFAULT_INFERRED_DEADLINE_DAYS} days from now.`,
        "When you infer or assume a deadline, explain it in assumptions.",
      ];

  return [
    "You are a task-planning assistant.",
    "Break down the task into actionable subtasks.",
    `Generate at most ${maxSteps} subtasks.`,
    "Return strict JSON only.",
    "Each subtask must include:",
    '- "title": short actionable title',
    '- "description": concrete next action',
    '- "dueAt": ISO 8601 datetime in UTC (example: 2026-02-20T09:00:00.000Z). Always output UTC (with Z), never local timezone format.',
    `- "durationMinutes": integer between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES}`,
    `Current datetime (UTC): ${now.toISOString()}`,
    `Reference timezone: ${planningTimezone}`,
    `Current datetime in reference timezone (for interpreting natural-language dates only): ${formatPromptDateInTimezone(now, planningTimezone)}`,
    "Resolve relative expressions such as today/tomorrow/next week using the reference timezone datetime above, but convert all final dueAt values to UTC ISO 8601 before returning JSON.",
    ...deadlineGuidance,
    `Task: ${payload.task}`,
    payload.context ? `Context: ${payload.context}` : "",
    'Output format: {"goal":"string","summary":"string","subtasks":[{"title":"string","description":"string","dueAt":"string","durationMinutes":60}],"assumptions":["..."]}',
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export async function decomposeWithWorkersAi(
  env: Env,
  payload: TaskDecomposeRequest,
): Promise<TaskDecomposeResult> {
  const prompt = createPrompt(payload);

  const result = await env.AI.run(AI_MODEL, {
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1100,
  });

  const text =
    typeof result === "object" &&
    result !== null &&
    "response" in result &&
    typeof result.response === "string"
      ? result.response
      : JSON.stringify(result);

  const cleaned = cleanAiText(text);

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return normalizeResult(parsed, payload);
  } catch {
    const fallbackParsed = {
      goal: payload.task,
      summary: fallbackSummary(payload.task),
      assumptions: [
        "Workers AI response was not valid JSON. Used a fallback task plan.",
        `Raw response: ${cleaned.slice(0, 800)}`,
      ],
    } satisfies Record<string, unknown>;

    return normalizeResult(fallbackParsed, payload);
  }
}
