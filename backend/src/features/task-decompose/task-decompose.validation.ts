import type { TaskDecomposeRequest } from "./task-decompose.types";

export function toRequestPayload(input: unknown): TaskDecomposeRequest | null {
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
	const userId =
		typeof candidate.userId === "string" && candidate.userId.trim().length > 0
			? candidate.userId.trim()
			: undefined;

	return {
		task: candidate.task.trim(),
		context,
		userId,
	};
}
