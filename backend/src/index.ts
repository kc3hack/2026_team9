import { Hono } from "hono";
import {
	WorkflowEntrypoint,
	WorkflowEvent,
	WorkflowStep,
} from "cloudflare:workers";

const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

type TaskDecomposeRequest = {
	task: string;
	context?: string;
};

type TaskDecomposeResult = {
	goal: string;
	subtasks: string[];
	assumptions: string[];
};

function toRequestPayload(input: unknown): TaskDecomposeRequest | null {
	if (!input || typeof input !== "object") {
		return null;
	}

	const candidate = input as Record<string, unknown>;
	if (typeof candidate.task !== "string" || candidate.task.trim().length === 0) {
		return null;
	}

	const context =
		typeof candidate.context === "string" && candidate.context.trim().length > 0
			? candidate.context.trim()
			: undefined;

	return {
		task: candidate.task.trim(),
		context,
	};
}

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
		return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
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
				: ["Split the task into data gathering, implementation, and validation."],
		assumptions,
	};
}

async function decomposeWithWorkersAi(
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

export class TaskDecompositionWorkflow extends WorkflowEntrypoint<
	Env,
	TaskDecomposeRequest
> {
	async run(
		event: WorkflowEvent<TaskDecomposeRequest>,
		step: WorkflowStep,
	): Promise<TaskDecomposeResult> {
		const payload = toRequestPayload(event.payload);
		if (!payload) {
			throw new Error("Workflow payload must include a non-empty `task` string.");
		}

		return await step.do("decompose-task-with-workers-ai", async () => {
			return await decomposeWithWorkersAi(this.env, payload);
		});
	}
}

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
	return c.json({
		service: "task-decomposer-backend",
		endpoints: [
			"POST /tasks/decompose",
			"POST /workflows/decompose",
			"GET /workflows/:id",
		],
	});
});

app.post("/tasks/decompose", async (c) => {
	const body = await c.req.json().catch(() => null);
	const payload = toRequestPayload(body);
	if (!payload) {
		return c.json(
			{ error: "Request body must include a non-empty `task` field." },
			400,
		);
	}

	const breakdown = await decomposeWithWorkersAi(c.env, payload);
	return c.json({ breakdown });
});

app.post("/workflows/decompose", async (c) => {
	const body = await c.req.json().catch(() => null);
	const payload = toRequestPayload(body);
	if (!payload) {
		return c.json(
			{ error: "Request body must include a non-empty `task` field." },
			400,
		);
	}

	const instance = await c.env.MY_WORKFLOW.create({ params: payload });
	return c.json(
		{
			id: instance.id,
			status: await instance.status(),
		},
		202,
	);
});

app.get("/workflows/:id", async (c) => {
	const id = c.req.param("id");
	const instance = await c.env.MY_WORKFLOW.get(id);
	return c.json({
		id,
		status: await instance.status(),
	});
});

export default app;
