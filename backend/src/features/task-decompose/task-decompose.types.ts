export type TaskDecomposeRequest = {
  task: string;
  context?: string;
  userId?: string;
  deadline?: string;
  timezone?: string;
  maxSteps?: number;
};

export type ValidatedTaskDecomposeRequest = Omit<
  TaskDecomposeRequest,
  "timezone"
> & {
  timezone: string;
};

export type TaskSubtask = {
  title: string;
  description: string;
  dueAt: string;
  durationMinutes: number;
};

export type TaskDecomposeResult = {
  goal: string;
  summary: string;
  subtasks: TaskSubtask[];
  assumptions: string[];
};
