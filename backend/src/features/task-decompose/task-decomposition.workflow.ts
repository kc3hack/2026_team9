import {
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from "cloudflare:workers";
import { decomposeWithWorkersAi } from "./task-decompose.service";
import type {
	TaskDecomposeRequest,
	TaskDecomposeResult,
} from "./task-decompose.types";
import { toRequestPayload } from "./task-decompose.validation";

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
		if (!payload.userId || payload.userId.trim().length === 0) {
			throw new Error(
				"Workflow payload must include a non-empty `userId` string.",
			);
		}

		console.log("Starting task decomposition workflow", { userId: payload.userId });

		return await step.do("decompose-task-with-workers-ai", async () => {
			return await decomposeWithWorkersAi(this.env, payload);
		});
	}
}
