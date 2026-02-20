import type { ZodType } from "zod";

export type TaskDecomposeRequest = {
	task: string;
	context?: string;
	userId?: string;
};

export type TaskDecomposeResult = {
	goal: string;
	subtasks: string[];
	assumptions: string[];
};

export type TaskDecomposeSchemas = {
	TaskDecomposeRequestSchema: ZodType<TaskDecomposeRequest>;
	TaskDecomposeResultSchema: ZodType<TaskDecomposeResult>;
};

export function createTaskDecomposeSchemas(
	z: typeof import("zod"),
): TaskDecomposeSchemas {
	const TaskDecomposeRequestSchema = z.object({
		task: z.string().trim().min(1),
		context: z
			.string()
			.trim()
			.optional()
			.transform((value) => (value && value.length > 0 ? value : undefined)),
		userId: z
			.string()
			.trim()
			.optional()
			.transform((value) => (value && value.length > 0 ? value : undefined)),
	});

	const TaskDecomposeResultSchema = z.object({
		goal: z.string(),
		subtasks: z.array(z.string()),
		assumptions: z.array(z.string()),
	});

	return { TaskDecomposeRequestSchema, TaskDecomposeResultSchema };
}
