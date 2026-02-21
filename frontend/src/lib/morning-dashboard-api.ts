import { fetchMorningBriefing } from "./backend-api";

export type CalendarEvent = {
  title: string;
  location?: string | null;
  startTime: string;
};

export type MorningRoutineStep = {
  id: string;
  label: string;
  offsetMinutes: number;
  durationMinutes?: number;
  isOverride?: boolean;
};

export type MorningRoutineOverride = {
  date: string;
  steps: MorningRoutineStep[];
  note?: string;
};

export type MorningDashboard = {
  userId: string;
  date: string;
  earliestEvent: CalendarEvent | null;
  earliestEventJson?: string;
  wakeUpTime: string;
  departTime: string;
  createdAt: string;
  updatedAt: string;
  routine: MorningRoutineStep[];
  overrides?: MorningRoutineOverride[];
};

type BriefingEvent = {
  id: string;
  summary: string;
  location: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
};

type EventBriefing = {
  event: BriefingEvent;
  destination: string;
  transitMinutes: number;
  leaveBy: string;
  wakeUpBy: string;
  slackMinutes: number;
  lateRiskPercent: number;
};

type MorningBriefingResult = {
  date: string;
  now: string;
  totalEvents: number;
  briefings: EventBriefing[];
  urgent: EventBriefing | null;
  eventsWithoutLocation: BriefingEvent[];
  weather: {
    reason?: string;
  } | null;
};

function toJstHHmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const h = jst.getUTCHours().toString().padStart(2, "0");
  const m = jst.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

function offsetFromDepart(departTime: string, targetTime: string): number {
  const depart = hhmmToMinutes(departTime);
  const target = hhmmToMinutes(targetTime);
  return Math.max(0, depart - target);
}

export async function getMorningDashboard(options?: {
  date?: string;
  currentLocation?: string;
  prepMinutes?: number;
}): Promise<MorningDashboard> {
  const currentLocation = options?.currentLocation?.trim() || "大阪駅";
  const prepMinutes = options?.prepMinutes ?? 30;

  const raw = (await fetchMorningBriefing(
    currentLocation,
    prepMinutes,
  )) as MorningBriefingResult;

  const urgent = raw.urgent;
  const departTime = urgent?.leaveBy ?? "--:--";
  const wakeUpTime = urgent?.wakeUpBy ?? "--:--";
  const earliestStart = urgent ? toJstHHmm(urgent.event.start) : "--:--";

  const routine: MorningRoutineStep[] = urgent
    ? [
        {
          id: "wake",
          label: "起床",
          offsetMinutes: offsetFromDepart(departTime, wakeUpTime),
        },
        {
          id: "prepare",
          label: "身支度",
          offsetMinutes: Math.max(
            0,
            offsetFromDepart(departTime, wakeUpTime) - 20,
          ),
          durationMinutes: 20,
        },
        {
          id: "depart",
          label: "出発",
          offsetMinutes: 0,
        },
      ]
    : [];

  const overrides: MorningRoutineOverride[] = [];
  if (raw.weather?.reason) {
    overrides.push({
      date: raw.date,
      note: raw.weather.reason,
      steps: [],
    });
  }

  if (urgent && urgent.lateRiskPercent >= 60) {
    overrides.push({
      date: raw.date,
      note: `遅刻リスク ${urgent.lateRiskPercent}% — 早めの行動がおすすめ`,
      steps: [],
    });
  }

  return {
    userId: "current-user",
    date: raw.date,
    earliestEvent: urgent
      ? {
          title: urgent.event.summary,
          location: urgent.event.location,
          startTime: earliestStart,
        }
      : null,
    earliestEventJson: urgent ? JSON.stringify(urgent.event) : undefined,
    wakeUpTime,
    departTime,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    routine,
    overrides,
  };
}
