const DEFAULT_TASK_TIMEZONE = "Asia/Tokyo";

export function normalizeTaskTimezone(
  value: string | null | undefined,
): string {
  if (!value || value.trim().length === 0) {
    return DEFAULT_TASK_TIMEZONE;
  }

  const candidate = value.trim();
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: candidate,
    }).resolvedOptions().timeZone;
  } catch {
    return DEFAULT_TASK_TIMEZONE;
  }
}
