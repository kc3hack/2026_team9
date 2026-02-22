"use client";

import {
  Box,
  Button,
  Container,
  Drawer,
  Grid,
  GridItem,
  HStack,
  Input,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMorningBriefing,
  fetchMorningRoutine,
  type MorningRoutineItem,
  updateMorningRoutine,
} from "@/lib/backend-api";
import {
  getTaskWorkflowHistory,
  type WorkflowRecord,
} from "@/lib/task-workflow-api";

type BriefingEvent = {
  id: string;
  summary: string;
  location: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
};

type TransitRoute = {
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  summary: string;
};

type EventBriefing = {
  event: BriefingEvent;
  destination: string;
  route: TransitRoute | null;
  transitMinutes: number;
  leaveBy: string;
  wakeUpBy: string;
  slackMinutes: number;
  lateRiskPercent: number;
};

type WeatherInfo = {
  locationName: string;
  startIso: string;
  precipitationProbability: number;
  precipitationMm: number;
  umbrellaNeeded: boolean;
  reason: string;
};

type MorningBriefingResult = {
  date: string;
  now: string;
  totalEvents: number;
  briefings: EventBriefing[];
  urgent: EventBriefing | null;
  eventsWithoutLocation: BriefingEvent[];
  weather: WeatherInfo | null;
};

type State = {
  status: "loading" | "ready" | "error";
  data: MorningBriefingResult | null;
  errorType?: "unauthorized" | "unknown";
};

type DecomposedTaskEvent = {
  key: string;
  taskInput: string;
  summary: string;
  subtaskTitle: string;
  startAt: string;
  endAt: string;
};

type AlarmStatus = "idle" | "scheduled" | "ringing";

const TODAY_EVENTS_LIMIT = 3;
const DECOMPOSED_EVENTS_LIMIT = 3;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WAKEUP_ALARM_ENABLED_KEY = "dashboard:wakeup-alarm-enabled";
const DEFAULT_MORNING_ROUTINE: MorningRoutineItem[] = [
  { id: "prepare", label: "身支度", minutes: 20 },
  { id: "breakfast", label: "朝食", minutes: 15 },
];

function truncateText(value: string, maxLength: number): string {
  if (maxLength <= 0) {
    return "";
  }
  if (value.length <= maxLength) {
    return value;
  }

  const safe = Math.max(1, Math.trunc(maxLength) - 1);
  return `${value.slice(0, safe).trimEnd()}…`;
}

function toJstHHmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  const jst = new Date(d.getTime() + JST_OFFSET_MS);
  const h = jst.getUTCHours().toString().padStart(2, "0");
  const m = jst.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function eventDurationMinutes(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
}

function collectUpcomingDecomposedEvents(
  records: WorkflowRecord[],
  limit: number,
): DecomposedTaskEvent[] {
  const now = Date.now();
  const flattened = records.flatMap((record) =>
    (record.calendarOutput?.createdEvents ?? []).map((eventItem) => ({
      key: `${record.workflowId}:${eventItem.id}`,
      taskInput: record.taskInput,
      summary: eventItem.summary,
      subtaskTitle: eventItem.subtaskTitle,
      startAt: eventItem.startAt,
      endAt: eventItem.endAt,
    })),
  );

  return flattened
    .filter((eventItem) => {
      const startAtMs = new Date(eventItem.startAt).getTime();
      return Number.isFinite(startAtMs) && startAtMs >= now;
    })
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    )
    .slice(0, Math.max(1, Math.trunc(limit)));
}

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

function normalizeRoutineItems(value: unknown): MorningRoutineItem[] | null {
  if (!Array.isArray(value)) {
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
        typeof candidate.label === "string" && candidate.label.trim().length > 0
          ? candidate.label.trim()
          : null;
      if (!label) {
        return null;
      }

      const minutes =
        typeof candidate.minutes === "number"
          ? clampMinutes(candidate.minutes)
          : 0;
      const id =
        typeof candidate.id === "string" && candidate.id.trim().length > 0
          ? candidate.id
          : createRoutineItemId();

      return { id, label, minutes } satisfies MorningRoutineItem;
    })
    .filter((item): item is MorningRoutineItem => item !== null);

  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function inferTransferCount(summary: string | null | undefined): number | null {
  if (!summary || summary.trim().length === 0) {
    return null;
  }

  const patterns = [
    /乗り換え\s*(\d+)\s*回/u,
    /乗換(?:え)?\s*(\d+)\s*回/u,
    /(\d+)\s*回乗換/u,
  ];

  for (const pattern of patterns) {
    const matched = pattern.exec(summary);
    if (!matched?.[1]) {
      continue;
    }

    const count = Number(matched[1]);
    if (Number.isFinite(count)) {
      return count;
    }
  }

  return null;
}

function shortenSpeechDestination(value: string): string {
  const normalized = value
    .replace(/〒\s*\d{3}-?\d{4}\s*/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (normalized.length === 0) {
    return "目的地未設定";
  }

  const stationMatch = normalized.match(/([^\s、,]{1,12}駅)/u);
  if (stationMatch?.[1]) {
    return stationMatch[1];
  }

  const landmarkMatch = normalized.match(
    /([^\s、,]{1,14}(?:空港|ビル|大学|病院|公園|会館))/u,
  );
  if (landmarkMatch?.[1]) {
    return landmarkMatch[1];
  }

  const firstChunk = normalized.split(/[、,/]/u)[0]?.trim();
  if (!firstChunk) {
    return "目的地未設定";
  }

  if (firstChunk.length <= 14) {
    return firstChunk;
  }

  return `${firstChunk.slice(0, 14)}付近`;
}

function buildWakeupSpeech(
  urgent: EventBriefing | null,
  weather: WeatherInfo | null,
): string {
  if (!urgent) {
    return "本日の予定はまだ取得できていません。";
  }

  const startAt = toJstHHmm(urgent.event.start);
  const destination =
    urgent.destination?.trim() ||
    urgent.event.location?.trim() ||
    "目的地未設定";
  const speechDestination = shortenSpeechDestination(destination);
  const transferCount = inferTransferCount(urgent.route?.summary ?? null);
  const transferText =
    transferCount !== null
      ? `乗り換え${transferCount}回`
      : urgent.route?.summary?.trim()
        ? urgent.route.summary
        : "乗り換え情報なし";
  const transitText =
    urgent.transitMinutes > 0
      ? `${urgent.transitMinutes}分`
      : "移動時間は未取得";
  const umbrellaText = weather?.umbrellaNeeded
    ? "雨のため傘を持ってください。"
    : "傘は不要です。";

  return `今日は${startAt}から${speechDestination}。${transferText}、${transitText}。${urgent.leaveBy}出発推奨。${umbrellaText}`;
}

export default function DashboardPage() {
  const [state, setState] = useState<State>({
    status: "loading",
    data: null,
    errorType: undefined,
  });
  const [locationInput, setLocationInput] = useState("大阪駅");
  const [currentLocation, setCurrentLocation] = useState("大阪駅");
  const [forceRefresh, setForceRefresh] = useState(false);
  const [upcomingTaskEvents, setUpcomingTaskEvents] = useState<
    DecomposedTaskEvent[]
  >([]);
  const [taskEventsStatus, setTaskEventsStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [alarmStatus, setAlarmStatus] = useState<AlarmStatus>("idle");
  const [alarmTargetMs, setAlarmTargetMs] = useState<number | null>(null);
  const [alarmMessage, setAlarmMessage] = useState<string | null>(null);
  const [lastGuidanceText, setLastGuidanceText] = useState<string | null>(null);
  const [morningRoutine, setMorningRoutine] = useState<MorningRoutineItem[]>(
    DEFAULT_MORNING_ROUTINE,
  );
  const [routineStatus, setRoutineStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [routineError, setRoutineError] = useState<string | null>(null);
  const [isRoutineDrawerOpen, setIsRoutineDrawerOpen] = useState(false);
  const [routineDraft, setRoutineDraft] = useState<MorningRoutineItem[]>(
    DEFAULT_MORNING_ROUTINE,
  );
  const [isRoutineSaving, setIsRoutineSaving] = useState(false);
  const [routineEditorError, setRoutineEditorError] = useState<string | null>(
    null,
  );
  const alarmTimeoutRef = useRef<number | null>(null);
  const alarmIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const routineTotalMinutes = useMemo(() => {
    const total = morningRoutine.reduce(
      (sum, item) => sum + clampMinutes(item.minutes),
      0,
    );
    return Math.max(1, Math.min(300, total));
  }, [morningRoutine]);
  const routineDraftTotalMinutes = useMemo(() => {
    const total = routineDraft.reduce(
      (sum, item) => sum + clampMinutes(item.minutes),
      0,
    );
    return Math.max(1, Math.min(300, total));
  }, [routineDraft]);

  useEffect(() => {
    let active = true;
    setRoutineStatus("loading");
    setRoutineError(null);

    fetchMorningRoutine()
      .then((response) => {
        if (!active) {
          return;
        }
        const normalized = normalizeRoutineItems(response.items);
        if (normalized) {
          setMorningRoutine(normalized);
        } else {
          setMorningRoutine(DEFAULT_MORNING_ROUTINE);
        }
        setRoutineStatus("ready");
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setMorningRoutine(DEFAULT_MORNING_ROUTINE);
        setRoutineStatus("error");
        setRoutineError(
          "朝ルーティンを取得できませんでした。既定値を使用します。",
        );
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (routineStatus === "loading") {
      return;
    }

    let active = true;
    setState((prev) => ({ ...prev, status: "loading", errorType: undefined }));
    setTaskEventsStatus("loading");

    Promise.allSettled([
      fetchMorningBriefing(currentLocation, routineTotalMinutes, forceRefresh),
      getTaskWorkflowHistory(50),
    ])
      .then(([briefingResult, workflowResult]) => {
        if (!active) {
          return;
        }

        if (briefingResult.status === "fulfilled") {
          setState({
            status: "ready",
            data: briefingResult.value as MorningBriefingResult,
          });
        } else {
          const message =
            briefingResult.reason instanceof Error
              ? briefingResult.reason.message
              : "";
          const isUnauthorized =
            message.includes(" 401 ") || message.includes("401");
          setState({
            status: "error",
            data: null,
            errorType: isUnauthorized ? "unauthorized" : "unknown",
          });
        }

        if (workflowResult.status === "fulfilled") {
          setUpcomingTaskEvents(
            collectUpcomingDecomposedEvents(
              workflowResult.value.items,
              DECOMPOSED_EVENTS_LIMIT,
            ),
          );
          setTaskEventsStatus("ready");
        } else {
          setUpcomingTaskEvents([]);
          setTaskEventsStatus("error");
        }
      })
      .finally(() => {
        if (active) {
          setForceRefresh(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentLocation, forceRefresh, routineStatus, routineTotalMinutes]);

  const clearAlarmTimeout = useCallback(() => {
    if (alarmTimeoutRef.current !== null) {
      window.clearTimeout(alarmTimeoutRef.current);
      alarmTimeoutRef.current = null;
    }
  }, []);

  const stopAlarmSound = useCallback(() => {
    if (alarmIntervalRef.current !== null) {
      window.clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(0);
    }
  }, []);

  const ensureAudioContext =
    useCallback(async (): Promise<AudioContext | null> => {
      if (typeof window === "undefined") {
        return null;
      }

      const w = window as Window & { webkitAudioContext?: typeof AudioContext };
      const AudioContextCtor = globalThis.AudioContext ?? w.webkitAudioContext;
      if (!AudioContextCtor) {
        return null;
      }

      let context = audioContextRef.current;
      if (!context) {
        context = new AudioContextCtor();
        audioContextRef.current = context;
      }

      if (context.state === "suspended") {
        await context.resume().catch(() => undefined);
      }

      if (context.state !== "running") {
        return null;
      }

      return context;
    }, []);

  const playAlarmTone = useCallback(async (): Promise<boolean> => {
    const context = await ensureAudioContext();
    if (!context) {
      return false;
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.42, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.26);

    return true;
  }, [ensureAudioContext]);

  const speakBriefing = useCallback((text: string): boolean => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      return false;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 1;
    utterance.pitch = 1;

    const jaVoice = synth
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("ja"));
    if (jaVoice) {
      utterance.voice = jaVoice;
    }

    synth.speak(utterance);
    return true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem(WAKEUP_ALARM_ENABLED_KEY);
    if (saved === "1") {
      setAlarmEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      WAKEUP_ALARM_ENABLED_KEY,
      alarmEnabled ? "1" : "0",
    );
  }, [alarmEnabled]);

  useEffect(() => {
    return () => {
      clearAlarmTimeout();
      stopAlarmSound();

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      if (ctx) {
        void ctx.close().catch(() => undefined);
      }
    };
  }, [clearAlarmTimeout, stopAlarmSound]);

  const urgent = state.data?.urgent ?? null;
  const departure = urgent?.leaveBy ?? "--:--";
  const lateRisk = urgent?.lateRiskPercent ?? 0;
  const slack = urgent?.slackMinutes ?? 0;
  const transitSummary = urgent?.route?.summary ?? "経路情報なし";
  const transitMinutes = urgent?.transitMinutes ?? 0;
  const weather = state.data?.weather ?? null;
  const wakeupTiming = useMemo(() => {
    if (!urgent) {
      return null;
    }

    const eventStartMs = new Date(urgent.event.start).getTime();
    if (!Number.isFinite(eventStartMs)) {
      return null;
    }

    const safeTransitMinutes = Math.max(0, Math.trunc(urgent.transitMinutes));
    const leaveMs = eventStartMs - safeTransitMinutes * 60 * 1000;
    const wakeMs = leaveMs - routineTotalMinutes * 60 * 1000;
    if (!Number.isFinite(wakeMs)) {
      return null;
    }

    return {
      leaveMs,
      wakeMs,
      wakeLabel: toJstHHmm(new Date(wakeMs).toISOString()),
    };
  }, [routineTotalMinutes, urgent]);
  const wakeUpTime = wakeupTiming?.wakeLabel ?? urgent?.wakeUpBy ?? "--:--";
  const wakeupAlarmPlan = useMemo(() => {
    if (!wakeupTiming) {
      return null;
    }
    return { targetMs: wakeupTiming.wakeMs };
  }, [wakeupTiming]);

  const startAlarmSound = useCallback(async () => {
    clearAlarmTimeout();
    stopAlarmSound();
    setAlarmStatus("ringing");
    setAlarmMessage(null);

    const firstTonePlayed = await playAlarmTone();
    if (!firstTonePlayed) {
      setAlarmMessage(
        "アラーム音を再生できません。ブラウザで音声再生を許可してください。",
      );
    } else {
      alarmIntervalRef.current = window.setInterval(() => {
        void playAlarmTone();
      }, 900);
    }

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([260, 120, 260, 120, 480]);
    }

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("起床アラーム", {
          body: `${wakeUpTime} です。起きる時間です。`,
        });
      } catch {
        // Ignore notification failures.
      }
    }
  }, [clearAlarmTimeout, playAlarmTone, stopAlarmSound, wakeUpTime]);

  const handleEnableAlarm = useCallback(async () => {
    setAlarmMessage(null);
    const context = await ensureAudioContext();
    if (!context) {
      setAlarmMessage(
        "このブラウザではアラーム音を有効化できません。別ブラウザをお試しください。",
      );
      return;
    }

    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission().catch(() => undefined);
    }

    setAlarmEnabled(true);
  }, [ensureAudioContext]);

  const handleDisableAlarm = useCallback(() => {
    setAlarmEnabled(false);
    setAlarmStatus("idle");
    setAlarmTargetMs(null);
    clearAlarmTimeout();
    stopAlarmSound();
  }, [clearAlarmTimeout, stopAlarmSound]);

  const handleTestAlarm = useCallback(() => {
    void startAlarmSound();
  }, [startAlarmSound]);

  const handleStopAlarmAndSpeak = useCallback(() => {
    stopAlarmSound();
    setAlarmStatus("idle");

    const guidance = buildWakeupSpeech(urgent, weather);
    setLastGuidanceText(guidance);
    const spoken = speakBriefing(guidance);
    if (!spoken) {
      setAlarmMessage(
        "読み上げに対応していないブラウザです。案内文のみ表示します。",
      );
    }
  }, [speakBriefing, stopAlarmSound, urgent, weather]);

  const handleOpenRoutineEditor = useCallback(() => {
    setRoutineDraft(morningRoutine.map((item) => ({ ...item })));
    setRoutineEditorError(null);
    setIsRoutineDrawerOpen(true);
  }, [morningRoutine]);

  const handleRoutineLabelChange = useCallback((id: string, value: string) => {
    setRoutineDraft((prev) =>
      prev.map((item) => (item.id === id ? { ...item, label: value } : item)),
    );
  }, []);

  const handleRoutineMinutesChange = useCallback(
    (id: string, value: string) => {
      const parsed = Number(value);
      const minutes = Number.isFinite(parsed) ? clampMinutes(parsed) : 0;
      setRoutineDraft((prev) =>
        prev.map((item) => (item.id === id ? { ...item, minutes } : item)),
      );
    },
    [],
  );

  const handleAddRoutineItem = useCallback(() => {
    setRoutineDraft((prev) => [
      ...prev,
      {
        id: createRoutineItemId(),
        label: "追加ルーティン",
        minutes: 10,
      },
    ]);
  }, []);

  const handleRemoveRoutineItem = useCallback((id: string) => {
    setRoutineDraft((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const handleSaveRoutine = useCallback(async () => {
    const normalizedDraft = normalizeRoutineItems(routineDraft);
    if (!normalizedDraft) {
      setRoutineEditorError(
        "ルーティン項目を1件以上設定してください（ラベル必須）。",
      );
      return;
    }

    setRoutineEditorError(null);
    setIsRoutineSaving(true);
    try {
      const response = await updateMorningRoutine(normalizedDraft);
      const saved = normalizeRoutineItems(response.items) ?? normalizedDraft;
      setMorningRoutine(saved);
      setRoutineDraft(saved.map((item) => ({ ...item })));
      setIsRoutineDrawerOpen(false);
      setRoutineStatus("ready");
      setRoutineError(null);
      setForceRefresh(true);
    } catch {
      setRoutineEditorError(
        "保存に失敗しました。時間をおいて再試行してください。",
      );
    } finally {
      setIsRoutineSaving(false);
    }
  }, [routineDraft]);

  useEffect(() => {
    clearAlarmTimeout();

    if (!alarmEnabled || !wakeupAlarmPlan) {
      setAlarmTargetMs(null);
      setAlarmStatus((prev) => (prev === "ringing" ? prev : "idle"));
      return;
    }

    setAlarmTargetMs(wakeupAlarmPlan.targetMs);
    const delayMs = wakeupAlarmPlan.targetMs - Date.now();

    if (delayMs <= 0) {
      setAlarmStatus((prev) => (prev === "ringing" ? prev : "idle"));
      return;
    }

    setAlarmStatus((prev) => (prev === "ringing" ? prev : "scheduled"));
    alarmTimeoutRef.current = window.setTimeout(() => {
      void startAlarmSound();
    }, delayMs);

    return () => {
      clearAlarmTimeout();
    };
  }, [alarmEnabled, clearAlarmTimeout, startAlarmSound, wakeupAlarmPlan]);

  const alarmStatusLabel = useMemo(() => {
    if (!alarmEnabled) {
      return "OFF";
    }
    if (!wakeupAlarmPlan) {
      return "予定なし";
    }
    if (alarmStatus === "ringing") {
      return "鳴動中";
    }
    if (alarmStatus === "scheduled") {
      const scheduledTime =
        alarmTargetMs !== null
          ? toJstHHmm(new Date(alarmTargetMs).toISOString())
          : wakeUpTime;
      return `${scheduledTime} に鳴動予定`;
    }
    return "待機中";
  }, [alarmEnabled, alarmStatus, alarmTargetMs, wakeUpTime, wakeupAlarmPlan]);

  const todayEvents = useMemo(() => {
    const byId = new Map<string, BriefingEvent>();

    for (const b of state.data?.briefings ?? []) {
      byId.set(b.event.id, b.event);
    }
    for (const e of state.data?.eventsWithoutLocation ?? []) {
      byId.set(e.id, e);
    }

    return [...byId.values()]
      .filter((e) => !e.isAllDay)
      .sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
      );
  }, [state.data]);

  const applyLocation = () => {
    const next = locationInput.trim() || "大阪駅";
    setLocationInput(next);
    setCurrentLocation(next);
    setForceRefresh(true);
  };

  return (
    <Box
      minH="100dvh"
      bg="var(--app-bg)"
      py={{ base: 5, md: 8 }}
      position="relative"
      overflow="hidden"
    >
      <Box className="app-orb app-orb--one" aria-hidden="true" />
      <Box className="app-orb app-orb--two" aria-hidden="true" />

      <Container
        maxW="full"
        px={{ base: 4, md: 6, xl: 10 }}
        position="relative"
        zIndex={1}
      >
        <Box w="full" maxW="1600px" mx="auto">
          <Stack gap={{ base: 4, md: 5 }}>
            <HStack gap={2} flexWrap="wrap">
              <Button asChild size="xs" variant="outline">
                <NextLink href="/">トップへ</NextLink>
              </Button>
              <Button asChild size="xs" variant="outline">
                <NextLink href="/task-decomp">タスク細分化へ</NextLink>
              </Button>
            </HStack>

            <Card>
              <HStack
                justify="center"
                gap={2}
                flexWrap={{ base: "wrap", sm: "nowrap" }}
                align="stretch"
              >
                <Input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      applyLocation();
                    }
                  }}
                  flex="1"
                  minW={{ base: "0", sm: "220px" }}
                  bg="white"
                  borderColor="gray.300"
                  size="md"
                  placeholder="現在地（例: 大阪駅）"
                />
                <Button
                  size="md"
                  minW={{ base: "100%", sm: "84px" }}
                  colorPalette="gray"
                  onClick={applyLocation}
                >
                  更新
                </Button>
              </HStack>
              <Text color="gray.500" fontSize="xs" mt={2}>
                現在地: {currentLocation}
              </Text>
            </Card>

            <Grid
              templateColumns={{
                base: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
                xl: "repeat(12, minmax(0, 1fr))",
              }}
              gap={{ base: 4, md: 5 }}
              alignItems="stretch"
            >
              <GridItem colSpan={{ base: 1, md: 2, xl: 6 }}>
                <Card minH={{ base: "180px", md: "210px" }}>
                  <Stack h="full" justify="center" gap={1}>
                    <Text
                      color="gray.700"
                      fontSize={{ base: "sm", md: "md" }}
                      letterSpacing="0.08em"
                    >
                      出発まで
                    </Text>
                    <Text
                      fontSize={{ base: "5xl", md: "7xl" }}
                      fontWeight="bold"
                      color="gray.800"
                      lineHeight={1}
                    >
                      {departure}
                    </Text>
                    <HStack
                      gap={3}
                      flexWrap="wrap"
                      color="gray.600"
                      fontSize={{ base: "md", md: "lg" }}
                    >
                      <Text>
                        遅刻リスク{" "}
                        <Text
                          as="span"
                          color={lateRisk >= 60 ? "red.600" : "green.700"}
                          fontWeight="semibold"
                        >
                          {lateRisk}%
                        </Text>
                      </Text>
                      <Text>移動 {transitMinutes}分</Text>
                    </HStack>
                    <Text
                      color="gray.500"
                      fontSize={{ base: "sm", md: "md" }}
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      経路: {truncateText(transitSummary, 52)}
                    </Text>

                    <Stack gap={2} mt={2}>
                      <Text fontSize="xs" color="gray.600">
                        朝ルーティン（起床から出発まで）合計:{" "}
                        {routineTotalMinutes}分
                      </Text>
                      {routineStatus === "loading" ? (
                        <Text fontSize="xs" color="gray.500">
                          朝ルーティンを読み込み中...
                        </Text>
                      ) : null}

                      <Stack gap={1}>
                        {morningRoutine.map((item) => (
                          <HStack key={item.id} gap={2} align="center">
                            <Box
                              w="7px"
                              h="7px"
                              borderRadius="full"
                              bg="gray.400"
                              flexShrink={0}
                            />
                            <Text
                              fontSize="sm"
                              color="gray.700"
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                            >
                              {truncateText(item.label, 22)}
                            </Text>
                            <Text fontSize="sm" color="gray.500" ml="auto">
                              {clampMinutes(item.minutes)}分
                            </Text>
                          </HStack>
                        ))}
                      </Stack>

                      <HStack gap={2} flexWrap="wrap">
                        <Button
                          size="xs"
                          variant="outline"
                          colorPalette="blue"
                          onClick={handleOpenRoutineEditor}
                          disabled={routineStatus === "loading"}
                        >
                          ルーティンを編集
                        </Button>
                      </HStack>

                      {routineError ? (
                        <Text fontSize="xs" color="orange.700">
                          {routineError}
                        </Text>
                      ) : null}

                      <HStack gap={3} flexWrap="wrap">
                        <Text
                          fontSize={{ base: "sm", md: "md" }}
                          color="gray.700"
                        >
                          起床目安 {wakeUpTime}
                        </Text>
                        <Text
                          fontSize={{ base: "sm", md: "md" }}
                          color="gray.700"
                        >
                          アラーム {alarmStatusLabel}
                        </Text>
                      </HStack>

                      <HStack gap={2} flexWrap="wrap">
                        {alarmEnabled ? (
                          <Button
                            size="xs"
                            variant="outline"
                            colorPalette="gray"
                            onClick={handleDisableAlarm}
                          >
                            アラーム無効化
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            colorPalette="teal"
                            onClick={() => void handleEnableAlarm()}
                          >
                            アラーム有効化
                          </Button>
                        )}

                        {alarmStatus === "ringing" ? (
                          <Button
                            size="xs"
                            colorPalette="red"
                            onClick={handleStopAlarmAndSpeak}
                          >
                            停止して案内を再生
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="outline"
                            colorPalette="teal"
                            onClick={handleTestAlarm}
                          >
                            アラームテスト
                          </Button>
                        )}
                      </HStack>

                      {alarmMessage ? (
                        <Text fontSize="xs" color="orange.700">
                          {alarmMessage}
                        </Text>
                      ) : null}

                      {alarmEnabled && alarmTargetMs ? (
                        <Text fontSize="xs" color="gray.600">
                          次回鳴動予定:{" "}
                          {toJstHHmm(new Date(alarmTargetMs).toISOString())}
                        </Text>
                      ) : null}

                      {lastGuidanceText ? (
                        <Text fontSize="xs" color="gray.600" lineClamp={2}>
                          案内: {lastGuidanceText}
                        </Text>
                      ) : null}

                      <Text fontSize="xs" color="gray.500">
                        ※ アラームはこの画面を開いている間に動作します。
                      </Text>
                    </Stack>
                  </Stack>
                </Card>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 1, xl: 3 }}>
                <Card minH={{ base: "160px", md: "210px" }}>
                  <Text fontSize="md" color="gray.500" mb={1}>
                    交通
                  </Text>
                  <Text
                    fontSize={{ base: "3xl", md: "4xl" }}
                    fontWeight="semibold"
                    color="gray.800"
                  >
                    {transitMinutes}
                    <Text
                      as="span"
                      fontSize="xl"
                      color="gray.500"
                      fontWeight="normal"
                    >
                      分
                    </Text>
                  </Text>
                  <Text
                    color="gray.700"
                    fontSize={{ base: "md", md: "lg" }}
                    fontWeight="semibold"
                    mt={1}
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {truncateText(transitSummary, 22)}
                  </Text>
                </Card>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 1, xl: 3 }}>
                <Card minH={{ base: "160px", md: "210px" }}>
                  <Text fontSize="md" color="gray.500" mb={1}>
                    余裕
                  </Text>
                  <Text
                    fontSize={{ base: "3xl", md: "4xl" }}
                    fontWeight="semibold"
                    color="gray.800"
                  >
                    {Math.max(0, slack)}
                    <Text
                      as="span"
                      fontSize="xl"
                      color="gray.500"
                      fontWeight="normal"
                    >
                      分
                    </Text>
                  </Text>
                  <Text
                    color="gray.600"
                    fontSize={{ base: "md", md: "lg" }}
                    mt={1}
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {departure}に出れば
                  </Text>
                  <Box
                    mt={3}
                    h="8px"
                    bg="gray.200"
                    borderRadius="full"
                    overflow="hidden"
                  >
                    <Box
                      h="full"
                      borderRadius="full"
                      w={`${Math.min(100, Math.max(0, (Math.max(0, slack) / 60) * 100))}%`}
                      bg={slack < 5 ? "red.400" : "green.500"}
                    />
                  </Box>
                </Card>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 1, xl: 4 }}>
                <Card minH={{ base: "220px", md: "250px" }}>
                  <Text fontSize="md" color="gray.500" mb={2}>
                    今日の予定
                  </Text>
                  <Stack gap={3}>
                    {todayEvents.length === 0 ? (
                      <Text color="gray.500" fontSize="md">
                        予定はありません
                      </Text>
                    ) : (
                      todayEvents.slice(0, TODAY_EVENTS_LIMIT).map((event) => (
                        <HStack key={event.id} align="start" gap={3} w="full">
                          <Box
                            mt="6px"
                            w="10px"
                            h="10px"
                            borderRadius="full"
                            bg="green.500"
                            flexShrink={0}
                          />
                          <Stack gap={1} minW={0} flex="1">
                            <HStack gap={2}>
                              <Text
                                px={2}
                                py={0.5}
                                borderRadius="md"
                                bg="gray.100"
                                color="gray.700"
                                fontSize="sm"
                                fontWeight="semibold"
                                lineHeight={1.2}
                              >
                                {toJstHHmm(event.start)}
                              </Text>
                              <Text fontSize="sm" color="gray.500">
                                {eventDurationMinutes(event.start, event.end)}分
                              </Text>
                            </HStack>
                            <Text
                              fontSize={{ base: "lg", md: "xl" }}
                              fontWeight="semibold"
                              color="gray.800"
                              lineHeight={1.3}
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                            >
                              {truncateText(event.summary, 26)}
                            </Text>
                            <Text
                              fontSize={{ base: "sm", md: "md" }}
                              color="gray.500"
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                            >
                              {truncateText(event.location ?? "場所未設定", 24)}
                            </Text>
                          </Stack>
                        </HStack>
                      ))
                    )}
                  </Stack>
                </Card>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 1, xl: 4 }}>
                <Card minH={{ base: "220px", md: "250px" }}>
                  <Text fontSize="md" color="gray.500" mb={2}>
                    タスク細分化の予定
                  </Text>
                  <Stack gap={3}>
                    {taskEventsStatus === "loading" ? (
                      <Text color="gray.500" fontSize="md">
                        読み込み中...
                      </Text>
                    ) : upcomingTaskEvents.length === 0 ? (
                      <Text color="gray.500" fontSize="md">
                        直近の細分化予定はありません
                      </Text>
                    ) : (
                      upcomingTaskEvents.map((eventItem) => (
                        <HStack
                          key={eventItem.key}
                          align="start"
                          gap={3}
                          w="full"
                        >
                          <Box
                            mt="6px"
                            w="10px"
                            h="10px"
                            borderRadius="full"
                            bg="blue.500"
                            flexShrink={0}
                          />
                          <Stack gap={1} minW={0} flex="1">
                            <HStack gap={2}>
                              <Text
                                px={2}
                                py={0.5}
                                borderRadius="md"
                                bg="blue.50"
                                color="blue.700"
                                fontSize="sm"
                                fontWeight="semibold"
                                lineHeight={1.2}
                              >
                                {toJstHHmm(eventItem.startAt)}
                              </Text>
                              <Text fontSize="sm" color="gray.500">
                                {eventDurationMinutes(
                                  eventItem.startAt,
                                  eventItem.endAt,
                                )}
                                分
                              </Text>
                            </HStack>
                            <Text
                              fontSize={{ base: "lg", md: "xl" }}
                              fontWeight="semibold"
                              color="gray.800"
                              lineHeight={1.3}
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                            >
                              {truncateText(eventItem.subtaskTitle, 24)}
                            </Text>
                            <Text
                              fontSize={{ base: "sm", md: "md" }}
                              color="gray.500"
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                            >
                              {truncateText(eventItem.summary, 34)}
                            </Text>
                            <Text
                              fontSize={{ base: "sm", md: "md" }}
                              color="gray.500"
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                            >
                              元タスク: {truncateText(eventItem.taskInput, 18)}
                            </Text>
                          </Stack>
                        </HStack>
                      ))
                    )}
                    {taskEventsStatus === "error" && (
                      <Text color="orange.600" fontSize="sm">
                        細分化予定の取得に失敗しました。
                      </Text>
                    )}
                  </Stack>
                </Card>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 2, xl: 4 }}>
                <Card minH={{ base: "180px", md: "250px" }}>
                  <Text fontSize="md" color="gray.500" mb={2}>
                    天気
                  </Text>
                  <Grid
                    templateColumns={{ base: "1fr", sm: "1fr 1fr" }}
                    gap={3}
                    alignItems="center"
                  >
                    <HStack gap={3}>
                      <Text fontSize="3xl">
                        {weather?.umbrellaNeeded ? "☔" : "☀️"}
                      </Text>
                      <Stack gap={0}>
                        <Text
                          fontSize={{ base: "3xl", md: "4xl" }}
                          fontWeight="semibold"
                          color="gray.800"
                        >
                          {weather
                            ? `${weather.precipitationProbability}%`
                            : "--%"}
                        </Text>
                        <Text
                          fontSize={{ base: "md", md: "lg" }}
                          color="gray.600"
                        >
                          {weather?.umbrellaNeeded ? "傘あり" : "晴れ"}
                        </Text>
                      </Stack>
                    </HStack>

                    <Stack
                      gap={1}
                      color="gray.600"
                      fontSize={{ base: "md", md: "lg" }}
                      minW={0}
                    >
                      <Text>
                        降水量{" "}
                        {weather ? `${weather.precipitationMm} mm/h` : "--"}
                      </Text>
                      <Text
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                      >
                        {weather?.locationName ?? "-"}
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        {weather?.reason ?? "天気情報なし"}
                      </Text>
                    </Stack>
                  </Grid>
                </Card>
              </GridItem>
            </Grid>

            {state.status === "error" && (
              <Card>
                <Stack align="center" gap={2}>
                  <Text color="red.600" textAlign="center" fontSize="md">
                    {state.errorType === "unauthorized"
                      ? "ログインが必要です。"
                      : "API取得に失敗しました。ログイン状態とバックエンド起動を確認してください。"}
                  </Text>
                  {state.errorType === "unauthorized" && (
                    <Button
                      size="sm"
                      colorPalette="blue"
                      onClick={() => {
                        window.location.assign("/");
                      }}
                    >
                      ログイン画面へ
                    </Button>
                  )}
                </Stack>
              </Card>
            )}
          </Stack>
        </Box>
      </Container>

      <Drawer.Root
        open={isRoutineDrawerOpen}
        onOpenChange={(details) => {
          setIsRoutineDrawerOpen(details.open);
          if (!details.open) {
            setRoutineEditorError(null);
          }
        }}
        size={{ base: "full", md: "md" }}
      >
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header>
                <Drawer.Title>朝ルーティン編集</Drawer.Title>
                <Drawer.Description>
                  起床から出発までに必要な項目と時間を設定します。
                </Drawer.Description>
              </Drawer.Header>
              <Drawer.Body>
                <Stack gap={3}>
                  {routineDraft.map((item) => (
                    <HStack
                      key={item.id}
                      gap={2}
                      align="center"
                      flexWrap={{ base: "wrap", sm: "nowrap" }}
                    >
                      <Input
                        size="sm"
                        value={item.label}
                        onChange={(e) =>
                          handleRoutineLabelChange(item.id, e.target.value)
                        }
                        bg="white"
                        minW={{ base: "100%", sm: "220px" }}
                        maxW={{ base: "100%", sm: "260px" }}
                      />
                      <Input
                        size="sm"
                        type="number"
                        min={0}
                        max={180}
                        step={1}
                        value={item.minutes.toString()}
                        onChange={(e) =>
                          handleRoutineMinutesChange(item.id, e.target.value)
                        }
                        w={{ base: "104px", sm: "90px" }}
                        bg="white"
                      />
                      <Text fontSize="sm" color="gray.600">
                        分
                      </Text>
                      <Button
                        size="xs"
                        variant="outline"
                        colorPalette="gray"
                        onClick={() => handleRemoveRoutineItem(item.id)}
                        disabled={routineDraft.length <= 1}
                      >
                        削除
                      </Button>
                    </HStack>
                  ))}

                  <HStack gap={2} flexWrap="wrap">
                    <Button
                      size="xs"
                      variant="outline"
                      colorPalette="blue"
                      onClick={handleAddRoutineItem}
                    >
                      項目を追加
                    </Button>
                    <Text fontSize="sm" color="gray.600">
                      合計 {routineDraftTotalMinutes}分
                    </Text>
                  </HStack>

                  {routineEditorError ? (
                    <Text color="red.600" fontSize="sm">
                      {routineEditorError}
                    </Text>
                  ) : null}
                </Stack>
              </Drawer.Body>
              <Drawer.Footer>
                <Drawer.ActionTrigger asChild>
                  <Button variant="outline">キャンセル</Button>
                </Drawer.ActionTrigger>
                <Button
                  colorPalette="blue"
                  onClick={() => void handleSaveRoutine()}
                  loading={isRoutineSaving}
                >
                  保存
                </Button>
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </Box>
  );
}

function Card({
  children,
  minH,
}: {
  children: React.ReactNode;
  minH?: string | { base: string; md: string };
}) {
  return (
    <Box
      bg="white"
      borderRadius="2xl"
      p={{ base: 4, md: 5 }}
      minH={minH}
      h="full"
      borderWidth="1px"
      borderColor="gray.200"
      boxShadow="sm"
      overflow="hidden"
    >
      {children}
    </Box>
  );
}
