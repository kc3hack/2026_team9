import { z } from "zod";

export const TaskDecomposeRequestSchema = z.object({
	task: z.string().trim().min(1),
	context: z
		.string()
		.trim()
		.optional()
		.transform((value) => (value && value.length > 0 ? value : undefined)),
});

export type TaskDecomposeRequest = z.infer<
	typeof TaskDecomposeRequestSchema
>;

export const TaskDecomposeResultSchema = z.object({
	goal: z.string(),
	subtasks: z.array(z.string()),
	assumptions: z.array(z.string()),
});

export type TaskDecomposeResult = z.infer<typeof TaskDecomposeResultSchema>;
