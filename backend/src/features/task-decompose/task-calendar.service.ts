import { createAuth } from "../../lib/auth";
import type {
  TaskDecomposeRequest,
  TaskDecomposeResult,
} from "./task-decompose.types";
import type {
  CalendarCreatedEvent,
  CalendarSyncResult,
} from "./task-workflow.types";

const GOOGLE_PROVIDER_ID = "google";
const PRIMARY_CALENDAR_ID = "primary";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const MIN_DURATION_MINUTES = 15;
const BASE32HEX_ALPHABET = "0123456789abcdefghijklmnopqrstuv";
const CALENDAR_REAUTH_MARKER = "REAUTH_REQUIRED_CALENDAR_SCOPE";

type GoogleEventDateTime = {
  dateTime?: string;
};

type GoogleCalendarEventResponse = {
  id?: string;
  summary?: string;
  htmlLink?: string;
  status?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
};

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function buildEventSummary(
  subtaskTitle: string,
  overallTaskName: string,
  index: number,
  totalCount: number,
): string {
  const normalizedSubtask = toSingleLine(subtaskTitle);
  const normalizedOverall = truncate(toSingleLine(overallTaskName), 80);
  return `[${index + 1}/${totalCount}] ${normalizedSubtask} | ${normalizedOverall}`;
}

function safeDate(value: string, fallback: Date): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed;
}

function toIso(value: Date): string {
  return value.toISOString();
}

function encodeBase32Hex(bytes: Uint8Array): string {
  let output = "";
  let buffer = 0;
  let bitsInBuffer = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsInBuffer += 8;

    while (bitsInBuffer >= 5) {
      const index = (buffer >> (bitsInBuffer - 5)) & 31;
      output += BASE32HEX_ALPHABET[index];
      bitsInBuffer -= 5;
    }
  }

  if (bitsInBuffer > 0) {
    const index = (buffer << (5 - bitsInBuffer)) & 31;
    output += BASE32HEX_ALPHABET[index];
  }

  return output;
}

async function createStableEventId(
  workflowId: string,
  index: number,
): Promise<string> {
  const payload = new TextEncoder().encode(`${workflowId}:${index}`);
  const hash = await crypto.subtle.digest("SHA-256", payload);
  const encodedHash = encodeBase32Hex(new Uint8Array(hash));
  const indexSuffix = index.toString(32);

  // Google Calendar event id must contain only [a-v0-9].
  return `a${encodedHash.slice(0, 30)}${indexSuffix}`;
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `Google Calendar API responded with ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(text) as {
      error?: {
        message?: string;
      };
    };

    if (parsed.error?.message && parsed.error.message.trim().length > 0) {
      return parsed.error.message.trim();
    }
  } catch {
    // Ignore parse failure and fall back to raw text.
  }

  return text;
}

function isCalendarPermissionError(status: number, message: string): boolean {
  if (status === 401 || status === 403) {
    return true;
  }

  const lower = message.toLowerCase();
  return (
    lower.includes("insufficient") ||
    lower.includes("permission") ||
    lower.includes("forbidden")
  );
}

async function fetchExistingEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<GoogleCalendarEventResponse | null> {
  const encodedCalendarId = encodeURIComponent(calendarId);
  const encodedEventId = encodeURIComponent(eventId);
  const response = await fetch(
    `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedCalendarId}/events/${encodedEventId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as GoogleCalendarEventResponse;
}

async function insertEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  timezone: string,
  summary: string,
  description: string,
  startAt: Date,
  endAt: Date,
): Promise<GoogleCalendarEventResponse> {
  const encodedCalendarId = encodeURIComponent(calendarId);
  const response = await fetch(
    `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedCalendarId}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: eventId,
        summary,
        description,
        start: {
          dateTime: toIso(startAt),
          timeZone: timezone,
        },
        end: {
          dateTime: toIso(endAt),
          timeZone: timezone,
        },
      }),
    },
  );

  if (response.status === 409) {
    const existing = await fetchExistingEvent(accessToken, calendarId, eventId);
    if (existing) {
      return existing;
    }
  }

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response);
    if (isCalendarPermissionError(response.status, errorMessage)) {
      throw new Error(
        `${CALENDAR_REAUTH_MARKER}: Google Calendar の権限が不足しています。Google で再ログインしてカレンダー権限を再許可してください。`,
      );
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as GoogleCalendarEventResponse;
}

async function getGoogleAccessToken(env: Env, userId: string): Promise<string> {
  const auth = createAuth(env);
  const tokenPayload = await auth.api.getAccessToken({
    body: {
      providerId: GOOGLE_PROVIDER_ID,
      userId,
    },
  });

  if (
    !tokenPayload ||
    typeof tokenPayload.accessToken !== "string" ||
    tokenPayload.accessToken.trim().length === 0
  ) {
    throw new Error("Google access token could not be retrieved.");
  }

  return tokenPayload.accessToken;
}

function toCreatedEvent(
  event: GoogleCalendarEventResponse,
  fallback: {
    eventId: string;
    summary: string;
    subtaskTitle: string;
    startAt: string;
    endAt: string;
  },
): CalendarCreatedEvent {
  return {
    id: event.id ?? fallback.eventId,
    htmlLink: event.htmlLink ?? null,
    status: event.status ?? null,
    summary: event.summary ?? fallback.summary,
    subtaskTitle: fallback.subtaskTitle,
    startAt: event.start?.dateTime ?? fallback.startAt,
    endAt: event.end?.dateTime ?? fallback.endAt,
  };
}

export type CreateCalendarEventsInput = {
  workflowId: string;
  userId: string;
  request: TaskDecomposeRequest;
  breakdown: TaskDecomposeResult;
};

export async function createCalendarEvents(
  env: Env,
  input: CreateCalendarEventsInput,
): Promise<CalendarSyncResult> {
  const accessToken = await getGoogleAccessToken(env, input.userId);
  const timezone = input.request.timezone ?? "UTC";
  const calendarId = PRIMARY_CALENDAR_ID;

  const createdEvents: CalendarCreatedEvent[] = [];
  const totalCount = Math.max(input.breakdown.subtasks.length, 1);

  for (const [index, subtask] of input.breakdown.subtasks.entries()) {
    const fallbackDueAt = new Date(Date.now() + (index + 1) * 60 * 60 * 1000);
    const dueAt = safeDate(subtask.dueAt, fallbackDueAt);
    const durationMinutes = Math.max(
      Math.trunc(subtask.durationMinutes),
      MIN_DURATION_MINUTES,
    );
    const startAt = new Date(dueAt.getTime() - durationMinutes * 60 * 1000);
    const eventId = await createStableEventId(input.workflowId, index);
    const summary = buildEventSummary(
      subtask.title,
      input.request.task,
      index,
      totalCount,
    );
    const description = [
      `Original task: ${input.request.task}`,
      `Goal: ${input.breakdown.goal}`,
      `Workflow ID: ${input.workflowId}`,
      "",
      subtask.description,
    ].join("\n");

    const responseEvent = await insertEvent(
      accessToken,
      calendarId,
      eventId,
      timezone,
      summary,
      description,
      startAt,
      dueAt,
    );

    createdEvents.push(
      toCreatedEvent(responseEvent, {
        eventId,
        summary,
        subtaskTitle: subtask.title,
        startAt: startAt.toISOString(),
        endAt: dueAt.toISOString(),
      }),
    );
  }

  return {
    calendarId,
    timezone,
    createdEvents,
  };
}
