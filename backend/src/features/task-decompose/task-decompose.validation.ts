import {
	TaskDecomposeRequestSchema,
	type TaskDecomposeRequest,
} from "./task-decompose.types";

export function toRequestPayload(input: unknown): TaskDecomposeRequest | null {
	const result = TaskDecomposeRequestSchema.safeParse(input);
	if (!result.success) {
		return null;
	}

	return result.data;
}
