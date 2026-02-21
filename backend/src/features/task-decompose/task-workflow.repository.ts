import type {
  TaskWorkflowPersistInput,
  TaskWorkflowRecord,
} from "./task-workflow.types";

type WorkflowRow = {
  workflow_id: string;
  user_id: string;
  status: string;
  task_input: string;
  context: string | null;
  deadline: string | null;
  timezone: string | null;
  llm_output: string | null;
  calendar_output: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const SELECT_COLUMNS = `
  workflow_id,
  user_id,
  status,
  task_input,
  context,
  deadline,
  timezone,
  llm_output,
  calendar_output,
  error_message,
  created_at,
  updated_at,
  completed_at
`;

function parseJson<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function toRecord(row: WorkflowRow): TaskWorkflowRecord {
  return {
    workflowId: row.workflow_id,
    userId: row.user_id,
    status: row.status as TaskWorkflowRecord["status"],
    taskInput: row.task_input,
    context: row.context,
    deadline: row.deadline,
    timezone: row.timezone,
    llmOutput: parseJson(row.llm_output),
    calendarOutput: parseJson(row.calendar_output),
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function toJson(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
}

export async function upsertWorkflowJob(
  db: D1Database,
  input: TaskWorkflowPersistInput,
): Promise<void> {
  const now = new Date().toISOString();
  const completedAt =
    input.completedAt !== undefined
      ? input.completedAt
      : input.status === "completed" || input.status === "failed"
        ? now
        : null;

  await db
    .prepare(
      `
        insert into task_workflow_jobs (
          workflow_id,
          user_id,
          status,
          task_input,
          context,
          deadline,
          timezone,
          llm_output,
          calendar_output,
          error_message,
          created_at,
          updated_at,
          completed_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(workflow_id) do update set
          status = excluded.status,
          task_input = excluded.task_input,
          context = excluded.context,
          deadline = excluded.deadline,
          timezone = excluded.timezone,
          llm_output = coalesce(excluded.llm_output, task_workflow_jobs.llm_output),
          calendar_output = coalesce(excluded.calendar_output, task_workflow_jobs.calendar_output),
          error_message = excluded.error_message,
          updated_at = excluded.updated_at,
          completed_at = coalesce(excluded.completed_at, task_workflow_jobs.completed_at)
      `,
    )
    .bind(
      input.workflowId,
      input.userId,
      input.status,
      input.taskInput,
      input.context ?? null,
      input.deadline ?? null,
      input.timezone ?? null,
      toJson(input.llmOutput),
      toJson(input.calendarOutput),
      input.errorMessage ?? null,
      now,
      now,
      completedAt,
    )
    .run();
}

export async function getWorkflowJob(
  db: D1Database,
  workflowId: string,
  userId: string,
): Promise<TaskWorkflowRecord | null> {
  const row = await db
    .prepare(
      `
        select ${SELECT_COLUMNS}
        from task_workflow_jobs
        where workflow_id = ? and user_id = ?
        limit 1
      `,
    )
    .bind(workflowId, userId)
    .first<WorkflowRow>();

  if (!row) {
    return null;
  }

  return toRecord(row);
}

export async function listWorkflowJobs(
  db: D1Database,
  userId: string,
  limit = 20,
): Promise<TaskWorkflowRecord[]> {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.trunc(limit), 1), 100)
    : 20;

  const result = await db
    .prepare(
      `
        select ${SELECT_COLUMNS}
        from task_workflow_jobs
        where user_id = ?
        order by created_at desc
        limit ?
      `,
    )
    .bind(userId, safeLimit)
    .all<WorkflowRow>();

  const rows = result.results ?? [];
  return rows.map(toRecord);
}
