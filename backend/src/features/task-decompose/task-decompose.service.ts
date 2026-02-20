import type {
  TaskDecomposeRequest,
  TaskDecomposeResult,
} from "./task-decompose.types";

const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

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

function normalizeResult(
  candidate: Partial<TaskDecomposeResult>,
  task: string,
): TaskDecomposeResult {
  const goal =
    typeof candidate.goal === "string" && candidate.goal.trim().length > 0
      ? candidate.goal.trim()
      : task;

  const subtasks = asStringArray(candidate.subtasks);
  const assumptions = asStringArray(candidate.assumptions);

  return {
    goal,
    subtasks:
      subtasks.length > 0
        ? subtasks
        : [
            "Split the task into data gathering, implementation, and validation.",
          ],
    assumptions,
  };
}

export async function decomposeWithWorkersAi(
  env: Env,
  payload: TaskDecomposeRequest,
): Promise<TaskDecomposeResult> {
  const prompt = [
    "You are a task decomposition assistant.",
    "Break down the user's task into concrete subtasks.",
    "Return strict JSON only.",
    `Task: ${payload.task}`,
    payload.context ? `Context: ${payload.context}` : "",
    'Output format: {"goal":"string","subtasks":["..."],"assumptions":["..."]}',
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  const result = await env.AI.run(AI_MODEL, {
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
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
    const parsed = JSON.parse(cleaned) as Partial<TaskDecomposeResult>;
    return normalizeResult(parsed, payload.task);
  } catch {
    return normalizeResult(
      {
        goal: payload.task,
        subtasks: [cleaned],
        assumptions: [
          "Workers AI response was not valid JSON. Returning the raw response as a single subtask.",
        ],
      },
      payload.task,
    );
  }
}
