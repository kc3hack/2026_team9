create table if not exists "task_workflow_jobs" (
  "workflow_id" text not null primary key,
  "user_id" text not null,
  "status" text not null,
  "task_input" text not null,
  "context" text,
  "deadline" text,
  "timezone" text,
  "llm_output" text,
  "calendar_output" text,
  "error_message" text,
  "created_at" text not null,
  "updated_at" text not null,
  "completed_at" text
);

create index if not exists "task_workflow_jobs_user_created_at_idx"
  on "task_workflow_jobs" ("user_id", "created_at" desc);
