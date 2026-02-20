import { z } from "zod";
import {
	createTaskDecomposeSchemas,
	type TaskDecomposeRequest,
	type TaskDecomposeResult,
} from "../../../../shared/task-decompose";

const { TaskDecomposeRequestSchema, TaskDecomposeResultSchema } =
	createTaskDecomposeSchemas(z);

export type { TaskDecomposeRequest, TaskDecomposeResult };
export { TaskDecomposeRequestSchema, TaskDecomposeResultSchema };
