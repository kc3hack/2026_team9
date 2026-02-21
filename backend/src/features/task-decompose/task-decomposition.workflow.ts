import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { createCalendarEvents } from "./task-calendar.service";
import { decomposeWithWorkersAi } from "./task-decompose.service";
import type {
  TaskDecomposeRequest,
  TaskDecomposeResult,
} from "./task-decompose.types";
import { toRequestPayload } from "./task-decompose.validation";
import { upsertWorkflowJob } from "./task-workflow.repository";
import type { CalendarSyncResult } from "./task-workflow.types";

export type TaskDecompositionWorkflowOutput = {
  breakdown: TaskDecomposeResult;
  calendar: CalendarSyncResult;
};

export class TaskDecompositionWorkflow extends WorkflowEntrypoint<
  Env,
  TaskDecomposeRequest
> {
  async run(
    event: WorkflowEvent<TaskDecomposeRequest>,
    step: WorkflowStep,
  ): Promise<TaskDecompositionWorkflowOutput> {
    const payload = toRequestPayload(event.payload);
    if (!payload) {
      throw new Error(
        "Workflow payload must include a non-empty `task` string.",
      );
    }
    if (!payload.userId || payload.userId.trim().length === 0) {
      throw new Error(
        "Workflow payload must include a non-empty `userId` string.",
      );
    }
    const userId = payload.userId;

    console.log("Starting task decomposition workflow", {
      workflowId: event.instanceId,
      userId: payload.userId,
    });

    const persistBase = {
      workflowId: event.instanceId,
      userId,
      taskInput: payload.task,
      context: payload.context,
      deadline: payload.deadline,
      timezone: payload.timezone,
    } as const;

    await step.do("mark-workflow-running", async () => {
      await upsertWorkflowJob(this.env.AUTH_DB, {
        ...persistBase,
        status: "running",
      });
      return true;
    });

    try {
      const breakdown = await step.do(
        "decompose-task-with-workers-ai",
        async () => {
          return await decomposeWithWorkersAi(this.env, payload);
        },
      );

      await step.do("mark-calendar-syncing", async () => {
        await upsertWorkflowJob(this.env.AUTH_DB, {
          ...persistBase,
          status: "calendar_syncing",
          llmOutput: breakdown,
        });
        return true;
      });

      const calendar = await step.do(
        "sync-subtasks-to-google-calendar",
        async () => {
          return await createCalendarEvents(this.env, {
            workflowId: event.instanceId,
            userId,
            request: payload,
            breakdown,
          });
        },
      );

      await step.do("persist-workflow-result", async () => {
        await upsertWorkflowJob(this.env.AUTH_DB, {
          ...persistBase,
          status: "completed",
          llmOutput: breakdown,
          calendarOutput: calendar,
          errorMessage: null,
        });
        return true;
      });

      return {
        breakdown,
        calendar,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Workflow execution failed with an unknown error.";

      await step.do("persist-workflow-failure", async () => {
        await upsertWorkflowJob(this.env.AUTH_DB, {
          ...persistBase,
          status: "failed",
          errorMessage,
        });
        return true;
      });

      throw error;
    }
  }
}
