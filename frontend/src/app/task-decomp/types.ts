export type RunPhase = "idle" | "starting" | "waiting" | "completed" | "failed";
export type ErrorAction =
  | "start"
  | "status"
  | "history"
  | "session"
  | "signOut";
export type ViewMode = "auth" | "compose" | "running" | "result";
export type TransitionDirection = "forward" | "backward";
