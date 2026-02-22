export type MorningRoutineItem = {
  id: string;
  label: string;
  minutes: number;
};

type RoutineRow = {
  routine_json: string;
};

const DEFAULT_MORNING_ROUTINE: MorningRoutineItem[] = [
  { id: "prepare", label: "身支度", minutes: 20 },
  { id: "breakfast", label: "朝食", minutes: 15 },
];

function createRoutineItemId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(180, Math.max(0, Math.trunc(value)));
}

function cloneItems(items: MorningRoutineItem[]): MorningRoutineItem[] {
  return items.map((item) => ({ ...item }));
}

function normalizeRoutineItems(value: unknown): MorningRoutineItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  if (value.length === 0 || value.length > 20) {
    return null;
  }

  const normalized = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as {
        id?: unknown;
        label?: unknown;
        minutes?: unknown;
      };

      const label =
        typeof candidate.label === "string" ? candidate.label.trim() : "";
      if (label.length === 0 || label.length > 40) {
        return null;
      }

      const minutesRaw =
        typeof candidate.minutes === "number"
          ? candidate.minutes
          : typeof candidate.minutes === "string"
            ? Number(candidate.minutes)
            : Number.NaN;
      const minutes = Number.isFinite(minutesRaw)
        ? clampMinutes(minutesRaw)
        : 0;

      const id =
        typeof candidate.id === "string" && candidate.id.trim().length > 0
          ? candidate.id.trim()
          : createRoutineItemId();

      return { id, label, minutes } satisfies MorningRoutineItem;
    })
    .filter((item): item is MorningRoutineItem => item !== null);

  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function parseRoutineJson(json: string): MorningRoutineItem[] | null {
  try {
    return normalizeRoutineItems(JSON.parse(json));
  } catch {
    return null;
  }
}

export function validateMorningRoutineItems(
  value: unknown,
): MorningRoutineItem[] | null {
  return normalizeRoutineItems(value);
}

export async function getMorningRoutine(
  db: D1Database,
  userId: string,
): Promise<MorningRoutineItem[]> {
  const row = await db
    .prepare(
      `
        select routine_json
        from morning_routine_settings
        where user_id = ?
        limit 1
      `,
    )
    .bind(userId)
    .first<RoutineRow>();

  if (!row?.routine_json) {
    return cloneItems(DEFAULT_MORNING_ROUTINE);
  }

  const parsed = parseRoutineJson(row.routine_json);
  if (!parsed) {
    return cloneItems(DEFAULT_MORNING_ROUTINE);
  }

  return parsed;
}

export async function saveMorningRoutine(
  db: D1Database,
  userId: string,
  items: MorningRoutineItem[],
): Promise<MorningRoutineItem[]> {
  const normalized = normalizeRoutineItems(items);
  if (!normalized) {
    throw new Error("Invalid morning routine items.");
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `
        insert into morning_routine_settings (
          user_id,
          routine_json,
          created_at,
          updated_at
        )
        values (?, ?, ?, ?)
        on conflict(user_id) do update set
          routine_json = excluded.routine_json,
          updated_at = excluded.updated_at
      `,
    )
    .bind(userId, JSON.stringify(normalized), now, now)
    .run();

  return normalized;
}
