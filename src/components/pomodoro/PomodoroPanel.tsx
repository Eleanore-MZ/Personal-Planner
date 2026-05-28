import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Category, Task, TimeBlockKind } from "../../types/domain";
import type { CreateTimeBlockInput } from "../../types/plannerApi";
import { getCategoryColorValues } from "../../utils/calendar";
import { isTaskComplete, orderTasksByDueDate } from "../../utils/tasks";
import { SegmentedControl, ToggleRow } from "../ui/ChoiceControls";

type PomodoroPanelProps = {
  categories: Category[];
  selectedTask?: Task;
  tasks: Task[];
  onCompleteSession: (timeBlock: CreateTimeBlockInput) => void | Promise<void>;
  onMarkTaskDone: (taskId: string) => void | Promise<void>;
};

type TimerState = "idle" | "running" | "paused" | "completed";
type BreakTimerState = "idle" | "running" | "paused" | "completed";
type CancelSessionAction = "discard" | "partial" | "abandoned";

type PersistedTimerSession = {
  durationMinutes: number;
  startedAt: string;
  status: "running" | "paused";
  pausedAt?: string;
  totalPausedMs: number;
};

type PersistedFocusSession = PersistedTimerSession & {
  version: 1;
  taskId?: string;
  categoryId: string;
  kind?: TimeBlockKind;
  title?: string;
};

type PersistedBreakSession = PersistedTimerSession & {
  version: 1;
};

const durationOptions = [
  { label: "25", value: 25 },
  { label: "50", value: 50 },
  { label: "Custom", value: 0 },
];

const blockKindOptions: Array<{ value: TimeBlockKind; label: string }> = [
  { value: "event", label: "Event" },
  { value: "task-session", label: "Task session" },
  { value: "habit", label: "Habit" },
  { value: "routine", label: "Routine" },
];

const activeFocusSessionKey = "planner:activeFocusSession";
const activeBreakSessionKey = "planner:activeBreakSession";
const focusSoundEnabledKey = "planner:focusSoundEnabled";
const focusNotificationEnabledKey = "planner:focusNotificationEnabled";
const focusCycleEnabledKey = "planner:focusCycleEnabled";
const focusCycleFocusMinutesKey = "planner:focusCycleFocusMinutes";
const focusCycleShortBreakMinutesKey = "planner:focusCycleShortBreakMinutes";
const focusCycleLongBreakMinutesKey = "planner:focusCycleLongBreakMinutes";
const focusCycleLongBreakAfterKey = "planner:focusCycleLongBreakAfter";
const focusCycleCountKey = "planner:focusCycleCount";

const readStoredBoolean = (key: string, fallback: boolean) => {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue === null) {
      return fallback;
    }

    return storedValue === "true";
  } catch {
    return fallback;
  }
};

const writeStoredBoolean = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, `${value}`);
  } catch {
    // Preference writes are best-effort.
  }
};

const readStoredNumber = (key: string, fallback: number) => {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue === null) {
      return fallback;
    }

    const parsedValue = Number(storedValue);
    return Number.isFinite(parsedValue) && parsedValue > 0
      ? parsedValue
      : fallback;
  } catch {
    return fallback;
  }
};

const writeStoredNumber = (key: string, value: number) => {
  try {
    localStorage.setItem(key, `${value}`);
  } catch {
    // Preference writes are best-effort.
  }
};

const clampWholeNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

const isTimeBlockKind = (value: unknown): value is TimeBlockKind =>
  blockKindOptions.some((option) => option.value === value);

const getDefaultPomodoroBlockKind = (
  task: Task | undefined,
  category: Category | undefined,
): TimeBlockKind => {
  if (task) {
    return "task-session";
  }

  return category?.defaultBlockKind ?? "event";
};

const getSessionTaskId = (session: PersistedFocusSession) => session.taskId;

const getSessionCategoryId = (session: PersistedFocusSession) =>
  session.categoryId;

const getSessionTitle = (
  session: PersistedFocusSession,
  category: Category | undefined,
) => session.title ?? category?.name ?? "Focus session";

const getSessionKind = (
  session: PersistedFocusSession,
  category: Category | undefined,
): TimeBlockKind =>
  session.kind ?? (session.taskId ? "task-session" : category?.defaultBlockKind ?? "event");

const formatRemainingTime = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
};

const isPersistedFocusSession = (
  value: unknown,
): value is PersistedFocusSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<PersistedFocusSession>;
  return (
    session.version === 1 &&
    typeof session.durationMinutes === "number" &&
    session.durationMinutes > 0 &&
    typeof session.startedAt === "string" &&
    typeof session.categoryId === "string" &&
    (session.status === "running" || session.status === "paused") &&
    typeof session.totalPausedMs === "number" &&
    (!session.pausedAt || typeof session.pausedAt === "string") &&
    (!session.taskId || typeof session.taskId === "string") &&
    (!session.kind || isTimeBlockKind(session.kind)) &&
    (!session.title || typeof session.title === "string")
  );
};

const isPersistedBreakSession = (
  value: unknown,
): value is PersistedBreakSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<PersistedBreakSession>;
  return (
    session.version === 1 &&
    typeof session.durationMinutes === "number" &&
    session.durationMinutes > 0 &&
    typeof session.startedAt === "string" &&
    (session.status === "running" || session.status === "paused") &&
    typeof session.totalPausedMs === "number" &&
    (!session.pausedAt || typeof session.pausedAt === "string")
  );
};

const readPersistedFocusSession = () => {
  try {
    const storedSession = localStorage.getItem(activeFocusSessionKey);
    if (!storedSession) {
      return undefined;
    }

    const parsedSession: unknown = JSON.parse(storedSession);
    return isPersistedFocusSession(parsedSession) ? parsedSession : undefined;
  } catch {
    return undefined;
  }
};

const readPersistedBreakSession = () => {
  try {
    const storedSession = localStorage.getItem(activeBreakSessionKey);
    if (!storedSession) {
      return undefined;
    }

    const parsedSession: unknown = JSON.parse(storedSession);
    return isPersistedBreakSession(parsedSession) ? parsedSession : undefined;
  } catch {
    return undefined;
  }
};

const writePersistedFocusSession = (session: PersistedFocusSession) => {
  localStorage.setItem(activeFocusSessionKey, JSON.stringify(session));
};

const writePersistedBreakSession = (session: PersistedBreakSession) => {
  localStorage.setItem(activeBreakSessionKey, JSON.stringify(session));
};

const clearPersistedFocusSession = () => {
  localStorage.removeItem(activeFocusSessionKey);
};

const clearPersistedBreakSession = () => {
  localStorage.removeItem(activeBreakSessionKey);
};

const getElapsedMs = (session: PersistedTimerSession, nowMs = Date.now()) => {
  const startedMs = new Date(session.startedAt).getTime();
  const effectiveNowMs =
    session.status === "paused" && session.pausedAt
      ? new Date(session.pausedAt).getTime()
      : nowMs;

  return Math.max(0, effectiveNowMs - startedMs - session.totalPausedMs);
};

const getRemainingSeconds = (
  session: PersistedTimerSession,
  nowMs = Date.now(),
) =>
  Math.max(
    0,
    Math.ceil(
      (session.durationMinutes * 60 * 1000 - getElapsedMs(session, nowMs)) /
        1000,
    ),
  );

const formatDurationLabel = (minutes: number) =>
  `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;

const formatElapsedLabel = (elapsedMs: number) => {
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  if (elapsedMinutes < 1) {
    return "less than 1m";
  }

  return `${elapsedMinutes}m`;
};

const playFocusCompletionSound = () => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.24);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.26);
    oscillator.addEventListener("ended", () => void audioContext.close());
  } catch {
    // Audio should never block session completion.
  }
};

const showCompletionNotification = (title: string, body: string) => {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  try {
    new Notification(title, { body });
  } catch {
    // Notifications are best-effort and may be unavailable in some shells.
  }
};

function PomodoroPanel({
  categories,
  selectedTask,
  tasks,
  onCompleteSession,
  onMarkTaskDone,
}: PomodoroPanelProps) {
  const openTasks = useMemo(
    () => orderTasksByDueDate(tasks.filter((task) => !isTaskComplete(task))),
    [tasks],
  );
  const selectableTasks = useMemo(() => {
    if (!selectedTask || openTasks.some((task) => task.id === selectedTask.id)) {
      return openTasks;
    }

    return [selectedTask, ...openTasks];
  }, [openTasks, selectedTask]);
  const [selectedTaskId, setSelectedTaskId] = useState(selectedTask?.id ?? "");
  const [customFocusTitle, setCustomFocusTitle] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    selectedTask?.categoryId ?? categories[0]?.id ?? "",
  );
  const [selectedBlockKind, setSelectedBlockKind] = useState<TimeBlockKind>(
    getDefaultPomodoroBlockKind(selectedTask, categories[0]),
  );
  const [durationPreset, setDurationPreset] = useState(25);
  const [customDuration, setCustomDuration] = useState(25);
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [breakTimerState, setBreakTimerState] =
    useState<BreakTimerState>("idle");
  const [breakRemainingSeconds, setBreakRemainingSeconds] = useState(5 * 60);
  const [completedMessage, setCompletedMessage] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(() =>
    readStoredBoolean(focusSoundEnabledKey, true),
  );
  const [notificationEnabled, setNotificationEnabled] = useState(() =>
    readStoredBoolean(focusNotificationEnabledKey, false),
  );
  const [cycleEnabled, setCycleEnabled] = useState(() =>
    readStoredBoolean(focusCycleEnabledKey, false),
  );
  const [cycleFocusMinutes, setCycleFocusMinutes] = useState(() =>
    readStoredNumber(focusCycleFocusMinutesKey, 25),
  );
  const [cycleShortBreakMinutes, setCycleShortBreakMinutes] = useState(() =>
    readStoredNumber(focusCycleShortBreakMinutesKey, 5),
  );
  const [cycleLongBreakMinutes, setCycleLongBreakMinutes] = useState(() =>
    readStoredNumber(focusCycleLongBreakMinutesKey, 15),
  );
  const [cycleLongBreakAfter, setCycleLongBreakAfter] = useState(() =>
    readStoredNumber(focusCycleLongBreakAfterKey, 4),
  );
  const [cycleCompletedFocusCount, setCycleCompletedFocusCount] = useState(() =>
    readStoredNumber(focusCycleCountKey, 0),
  );
  const [isCancelPromptOpen, setIsCancelPromptOpen] = useState(false);
  const [isEndPromptOpen, setIsEndPromptOpen] = useState(false);
  const [endedSessionTaskId, setEndedSessionTaskId] = useState<string>();
  const [activeSession, setActiveSession] =
    useState<PersistedFocusSession>();
  const [activeBreakSession, setActiveBreakSession] =
    useState<PersistedBreakSession>();
  const hasSavedSessionRef = useRef(false);
  const hasRestoredSessionRef = useRef(false);
  const hasRestoredBreakRef = useRef(false);
  const hasCompletedBreakRef = useRef(false);
  const isResolvingCancelRef = useRef(false);
  const isEndingSessionRef = useRef(false);

  const activeTask = tasks.find((task) => task.id === selectedTaskId);
  const endedSessionTask = tasks.find((task) => task.id === endedSessionTaskId);
  const durationMinutes = durationPreset === 0 ? customDuration : durationPreset;
  const activeCategory = categories.find(
    (category) => category.id === (activeTask?.categoryId || selectedCategoryId),
  );
  const canStart = durationMinutes > 0 && Boolean(activeTask || selectedCategoryId);
  const taskProvidesCategory = Boolean(activeTask?.categoryId);
  const hasActiveSession = timerState === "running" || timerState === "paused";
  const hasActiveBreak =
    breakTimerState === "running" || breakTimerState === "paused";
  const isBreakSurface = hasActiveBreak || breakTimerState === "completed";
  const hasLockedTimer = hasActiveSession || hasActiveBreak;
  const cancelElapsedMs = activeSession ? getElapsedMs(activeSession) : 0;
  const canSaveCancelRecord = cancelElapsedMs >= 60000;
  const canEndSessionRecord = cancelElapsedMs >= 60000;
  const cyclePosition =
    (cycleCompletedFocusCount % Math.max(1, cycleLongBreakAfter)) + 1;
  const nextCycleBreakMinutes =
    cycleCompletedFocusCount > 0 &&
    cycleCompletedFocusCount % Math.max(1, cycleLongBreakAfter) === 0
      ? cycleLongBreakMinutes
      : cycleShortBreakMinutes;
  const visibleRemainingSeconds = isBreakSurface
    ? breakRemainingSeconds
    : remainingSeconds;
  const visibleTotalSeconds = Math.max(
    1,
    ((isBreakSurface
      ? activeBreakSession?.durationMinutes
      : activeSession?.durationMinutes) ??
      (isBreakSurface ? nextCycleBreakMinutes : durationMinutes)) * 60,
  );
  const rawTimerProgress =
    (isBreakSurface
      ? breakTimerState === "completed"
      : timerState === "completed")
      ? 1
      : hasLockedTimer
        ? 1 - visibleRemainingSeconds / visibleTotalSeconds
        : 0;
  const timerProgress = Math.min(1, Math.max(0, rawTimerProgress));
  const timerProgressPercent = Math.round(timerProgress * 100);
  const timerRingRadius = 78;
  const timerRingCircumference = 2 * Math.PI * timerRingRadius;
  const timerRingOffset = timerRingCircumference * (1 - timerProgress);
  const timerVisualState = isBreakSurface ? breakTimerState : timerState;
  const timerModeLabel = isBreakSurface
    ? breakTimerState === "completed"
      ? "Complete"
      : breakTimerState === "paused"
        ? "Paused"
        : "Break"
    : timerState === "completed"
      ? "Complete"
      : timerState === "paused"
        ? "Paused"
      : timerState === "idle"
        ? "Ready"
        : "Focusing";

  useEffect(() => {
    if (hasRestoredSessionRef.current) {
      return;
    }

    const restoredSession = readPersistedFocusSession();
    if (!restoredSession) {
      hasRestoredSessionRef.current = true;
      return;
    }

    hasRestoredSessionRef.current = true;
    setActiveSession(restoredSession);
    setTimerState(restoredSession.status);
    setSelectedTaskId(restoredSession.taskId ?? "");
    setSelectedCategoryId(restoredSession.categoryId);
    setSelectedBlockKind(
      restoredSession.kind ??
        getDefaultPomodoroBlockKind(
          tasks.find((task) => task.id === restoredSession.taskId),
          categories.find((category) => category.id === restoredSession.categoryId),
        ),
    );
    setCustomFocusTitle(restoredSession.taskId ? "" : restoredSession.title ?? "");
    setDurationPreset(
      durationOptions.some(
        (option) => option.value === restoredSession.durationMinutes,
      )
        ? restoredSession.durationMinutes
        : 0,
    );
    setCustomDuration(restoredSession.durationMinutes);
    setRemainingSeconds(getRemainingSeconds(restoredSession));
    setCompletedMessage("Restored active session.");
  }, [categories, tasks]);

  useEffect(() => {
    if (hasRestoredBreakRef.current) {
      return;
    }

    const restoredBreak = readPersistedBreakSession();
    if (!restoredBreak) {
      hasRestoredBreakRef.current = true;
      return;
    }

    hasRestoredBreakRef.current = true;
    setActiveBreakSession(restoredBreak);
    setBreakTimerState(restoredBreak.status);
    setBreakRemainingSeconds(getRemainingSeconds(restoredBreak));
    setCompletedMessage("Restored active break.");
  }, []);

  useEffect(() => {
    if (hasActiveSession) {
      return;
    }

    setSelectedTaskId(selectedTask?.id ?? "");
    setSelectedCategoryId(selectedTask?.categoryId ?? categories[0]?.id ?? "");
    setSelectedBlockKind(
      getDefaultPomodoroBlockKind(
        selectedTask,
        categories.find(
          (category) => category.id === (selectedTask?.categoryId ?? categories[0]?.id),
        ),
      ),
    );
    if (selectedTask) {
      setCustomFocusTitle("");
    }
  }, [categories, hasActiveSession, selectedTask]);

  useEffect(() => {
    if (timerState !== "idle") {
      return;
    }

    setRemainingSeconds(Math.max(1, durationMinutes) * 60);
  }, [durationMinutes, timerState]);

  useEffect(() => {
    if (!activeSession) {
      return undefined;
    }

    const updateRemainingTime = () => {
      setRemainingSeconds(getRemainingSeconds(activeSession));
    };

    updateRemainingTime();

    if (timerState !== "running") {
      return undefined;
    }

    const intervalId = window.setInterval(updateRemainingTime, 1000);
    return () => window.clearInterval(intervalId);
  }, [activeSession, timerState]);

  useEffect(() => {
    if (!activeBreakSession) {
      return undefined;
    }

    const updateBreakRemainingTime = () => {
      setBreakRemainingSeconds(getRemainingSeconds(activeBreakSession));
    };

    updateBreakRemainingTime();

    if (breakTimerState !== "running") {
      return undefined;
    }

    const intervalId = window.setInterval(updateBreakRemainingTime, 1000);
    return () => window.clearInterval(intervalId);
  }, [activeBreakSession, breakTimerState]);

  useEffect(() => {
    if (
      !activeSession ||
      isCancelPromptOpen ||
      isEndPromptOpen ||
      (timerState !== "running" && timerState !== "paused") ||
      remainingSeconds > 0 ||
      hasSavedSessionRef.current
    ) {
      return;
    }

    const completedAt = new Date();
    const categoryId = getSessionCategoryId(activeSession);
    const category = categories.find((currentCategory) => currentCategory.id === categoryId);
    const completedTitle = getSessionTitle(activeSession, category);
    const notificationBody = `${completedTitle} finished after ${formatDurationLabel(
      activeSession.durationMinutes,
    )}.`;
    hasSavedSessionRef.current = true;
    clearPersistedFocusSession();
    if (soundEnabled) {
      playFocusCompletionSound();
    }
    if (notificationEnabled) {
      showCompletionNotification("Focus complete", notificationBody);
    }
    if (cycleEnabled) {
      setCycleCompletedFocusCount((currentCount) => {
        const nextCount = currentCount + 1;
        writeStoredNumber(focusCycleCountKey, nextCount);
        return nextCount;
      });
    }
    setTimerState("completed");
    setActiveSession(undefined);
    setCompletedMessage("Session saved");
    void onCompleteSession({
      title: completedTitle,
      notes: "Pomodoro focus session",
      taskId: getSessionTaskId(activeSession),
      categoryId,
      startsAt: activeSession.startedAt,
      endsAt: completedAt.toISOString(),
      isAllDay: false,
      kind: getSessionKind(activeSession, category),
      outcome: "active",
      source: "pomodoro",
      recurrenceFrequency: "none",
    });
  }, [
    activeSession,
    categories,
    notificationEnabled,
    onCompleteSession,
    remainingSeconds,
    isCancelPromptOpen,
    isEndPromptOpen,
    soundEnabled,
    timerState,
    cycleEnabled,
  ]);

  useEffect(() => {
    if (
      !activeBreakSession ||
      breakTimerState !== "running" ||
      breakRemainingSeconds > 0 ||
      hasCompletedBreakRef.current
    ) {
      return;
    }

    hasCompletedBreakRef.current = true;
    clearPersistedBreakSession();
    if (soundEnabled) {
      playFocusCompletionSound();
    }
    if (notificationEnabled) {
      showCompletionNotification(
        "Break complete",
        `${formatDurationLabel(activeBreakSession.durationMinutes)} break finished.`,
      );
    }
    setActiveBreakSession(undefined);
    setBreakTimerState("completed");
    setCompletedMessage("Break complete");
  }, [
    activeBreakSession,
    breakRemainingSeconds,
    breakTimerState,
    notificationEnabled,
    soundEnabled,
  ]);

  const updateSoundPreference = (enabled: boolean) => {
    setSoundEnabled(enabled);
    writeStoredBoolean(focusSoundEnabledKey, enabled);
  };

  const updateNotificationPreference = (enabled: boolean) => {
    if (!enabled) {
      setNotificationEnabled(false);
      writeStoredBoolean(focusNotificationEnabledKey, false);
      return;
    }

    if (!("Notification" in window)) {
      setCompletedMessage("Notifications are unavailable in this environment.");
      setNotificationEnabled(false);
      writeStoredBoolean(focusNotificationEnabledKey, false);
      return;
    }

    if (Notification.permission === "granted") {
      setNotificationEnabled(true);
      writeStoredBoolean(focusNotificationEnabledKey, true);
      return;
    }

    if (Notification.permission === "denied") {
      setCompletedMessage("Notifications are blocked for this app.");
      setNotificationEnabled(false);
      writeStoredBoolean(focusNotificationEnabledKey, false);
      return;
    }

    void Notification.requestPermission().then((permission) => {
      const isGranted = permission === "granted";
      setNotificationEnabled(isGranted);
      writeStoredBoolean(focusNotificationEnabledKey, isGranted);
      if (!isGranted) {
        setCompletedMessage("Notifications were not enabled.");
      }
    });
  };

  const updateCycleEnabled = (enabled: boolean) => {
    setCycleEnabled(enabled);
    writeStoredBoolean(focusCycleEnabledKey, enabled);
    if (!enabled) {
      setCycleCompletedFocusCount(0);
      writeStoredNumber(focusCycleCountKey, 0);
      return;
    }
    if (enabled && timerState === "idle" && !hasActiveBreak) {
      setDurationPreset(0);
      setCustomDuration(cycleFocusMinutes);
      setRemainingSeconds(cycleFocusMinutes * 60);
    }
  };

  const updateCycleNumberSetting = (
    value: number,
    min: number,
    max: number,
    key: string,
    setter: (nextValue: number) => void,
  ) => {
    const nextValue = clampWholeNumber(value, min, max);
    setter(nextValue);
    writeStoredNumber(key, nextValue);
  };

  const endCycleMode = () => {
    setCycleEnabled(false);
    writeStoredBoolean(focusCycleEnabledKey, false);
    setCycleCompletedFocusCount(0);
    writeStoredNumber(focusCycleCountKey, 0);
    if (!hasActiveSession) {
      clearPersistedBreakSession();
      setActiveBreakSession(undefined);
      setBreakTimerState("idle");
      setBreakRemainingSeconds(cycleShortBreakMinutes * 60);
    }
    if (timerState === "completed") {
      setTimerState("idle");
      setRemainingSeconds(durationMinutes * 60);
    }
    setCompletedMessage("Cycle ended");
  };

  const startSession = () => {
    if (!canStart) {
      return;
    }

    const nextDurationMinutes = cycleEnabled ? cycleFocusMinutes : durationMinutes;
    clearPersistedBreakSession();
    setActiveBreakSession(undefined);
    setBreakTimerState("idle");
    setCompletedMessage("");
    setIsCancelPromptOpen(false);
    setIsEndPromptOpen(false);
    setEndedSessionTaskId(undefined);
    isResolvingCancelRef.current = false;
    isEndingSessionRef.current = false;
    hasSavedSessionRef.current = false;
    const categoryId = activeTask?.categoryId || selectedCategoryId;
    const categoryTitle =
      categories.find((category) => category.id === categoryId)?.name ??
      "Focus session";
    const customTitle = customFocusTitle.trim();
    const sessionTitle =
      activeTask?.title ?? (customTitle || categoryTitle);
    const session: PersistedFocusSession = {
      version: 1,
      durationMinutes: nextDurationMinutes,
      startedAt: new Date().toISOString(),
      taskId: activeTask?.id,
      categoryId,
      kind: selectedBlockKind,
      status: "running",
      totalPausedMs: 0,
      title: sessionTitle,
    };
    writePersistedFocusSession(session);
    if (cycleEnabled) {
      setDurationPreset(0);
      setCustomDuration(cycleFocusMinutes);
    }
    setActiveSession(session);
    setRemainingSeconds(getRemainingSeconds(session));
    setTimerState("running");
  };

  const startBreak = (minutes: number) => {
    clearPersistedFocusSession();
    setActiveSession(undefined);
    setTimerState("completed");
    hasCompletedBreakRef.current = false;
    const breakSession: PersistedBreakSession = {
      version: 1,
      durationMinutes: minutes,
      startedAt: new Date().toISOString(),
      status: "running",
      totalPausedMs: 0,
    };
    writePersistedBreakSession(breakSession);
    setActiveBreakSession(breakSession);
    setBreakRemainingSeconds(getRemainingSeconds(breakSession));
    setBreakTimerState("running");
    setCompletedMessage("");
  };

  const pauseSession = () => {
    if (!activeSession || timerState !== "running") {
      return;
    }

    const pausedSession: PersistedFocusSession = {
      ...activeSession,
      status: "paused",
      pausedAt: new Date().toISOString(),
    };
    writePersistedFocusSession(pausedSession);
    setActiveSession(pausedSession);
    setRemainingSeconds(getRemainingSeconds(pausedSession));
    setTimerState("paused");
    setCompletedMessage("Paused");
  };

  const resumeSession = () => {
    if (!activeSession || timerState !== "paused") {
      return;
    }

    const pausedAtMs = activeSession.pausedAt
      ? new Date(activeSession.pausedAt).getTime()
      : Date.now();
    const nowMs = Date.now();
    const resumedSession: PersistedFocusSession = {
      ...activeSession,
      status: "running",
      pausedAt: undefined,
      totalPausedMs:
        activeSession.totalPausedMs + Math.max(0, nowMs - pausedAtMs),
    };
    writePersistedFocusSession(resumedSession);
    setActiveSession(resumedSession);
    setRemainingSeconds(getRemainingSeconds(resumedSession));
    setTimerState("running");
    setCompletedMessage("");
  };

  const pauseBreak = () => {
    if (!activeBreakSession || breakTimerState !== "running") {
      return;
    }

    const pausedBreak: PersistedBreakSession = {
      ...activeBreakSession,
      status: "paused",
      pausedAt: new Date().toISOString(),
    };
    writePersistedBreakSession(pausedBreak);
    setActiveBreakSession(pausedBreak);
    setBreakRemainingSeconds(getRemainingSeconds(pausedBreak));
    setBreakTimerState("paused");
    setCompletedMessage("Break paused");
  };

  const resumeBreak = () => {
    if (!activeBreakSession || breakTimerState !== "paused") {
      return;
    }

    const pausedAtMs = activeBreakSession.pausedAt
      ? new Date(activeBreakSession.pausedAt).getTime()
      : Date.now();
    const nowMs = Date.now();
    const resumedBreak: PersistedBreakSession = {
      ...activeBreakSession,
      status: "running",
      pausedAt: undefined,
      totalPausedMs:
        activeBreakSession.totalPausedMs + Math.max(0, nowMs - pausedAtMs),
    };
    writePersistedBreakSession(resumedBreak);
    setActiveBreakSession(resumedBreak);
    setBreakRemainingSeconds(getRemainingSeconds(resumedBreak));
    setBreakTimerState("running");
    setCompletedMessage("");
  };

  const endBreak = () => {
    clearPersistedBreakSession();
    setActiveBreakSession(undefined);
    hasCompletedBreakRef.current = false;
    setBreakRemainingSeconds(5 * 60);
    setBreakTimerState("completed");
    setCompletedMessage("Break ended");
  };

  const finishFocusFlow = () => {
    clearPersistedFocusSession();
    clearPersistedBreakSession();
    setActiveSession(undefined);
    setActiveBreakSession(undefined);
    setTimerState("idle");
    setBreakTimerState("idle");
    setIsEndPromptOpen(false);
    setEndedSessionTaskId(undefined);
    setRemainingSeconds(durationMinutes * 60);
    setBreakRemainingSeconds(5 * 60);
    setCompletedMessage("");
    hasSavedSessionRef.current = false;
    hasCompletedBreakRef.current = false;
    isEndingSessionRef.current = false;
    setCycleCompletedFocusCount(0);
    writeStoredNumber(focusCycleCountKey, 0);
  };

  const cancelSession = () => {
    if (!activeSession) {
      return;
    }

    setIsEndPromptOpen(false);
    setIsCancelPromptOpen(true);
    setCompletedMessage("");
  };

  const endSession = () => {
    if (!activeSession) {
      return;
    }

    setIsCancelPromptOpen(false);
    setCompletedMessage("");
    if (!canEndSessionRecord) {
      setIsEndPromptOpen(true);
      return;
    }

    void saveEndedSession();
  };

  const closeEndPrompt = () => {
    if (isEndingSessionRef.current) {
      return;
    }

    setIsEndPromptOpen(false);
  };

  const saveEndedSession = async (force = false) => {
    if (!activeSession || isEndingSessionRef.current) {
      return;
    }

    const elapsedMs = getElapsedMs(activeSession);
    if (elapsedMs < 60000 && !force) {
      setIsEndPromptOpen(true);
      return;
    }

    const focusedStart = new Date(activeSession.startedAt);
    const focusedEnd = new Date(focusedStart.getTime() + elapsedMs);
    const categoryId = getSessionCategoryId(activeSession);
    const category = categories.find((currentCategory) => currentCategory.id === categoryId);
    const title = getSessionTitle(activeSession, category);

    isEndingSessionRef.current = true;
    hasSavedSessionRef.current = true;
    clearPersistedFocusSession();
    await onCompleteSession({
      title,
      notes: "Pomodoro focus session ended early",
      taskId: getSessionTaskId(activeSession),
      categoryId,
      startsAt: focusedStart.toISOString(),
      endsAt: focusedEnd.toISOString(),
      isAllDay: false,
      kind: getSessionKind(activeSession, category),
      outcome: "active",
      source: "pomodoro",
      recurrenceFrequency: "none",
    });

    if (cycleEnabled) {
      setCycleCompletedFocusCount((currentCount) => {
        const nextCount = currentCount + 1;
        writeStoredNumber(focusCycleCountKey, nextCount);
        return nextCount;
      });
    }
    setEndedSessionTaskId(getSessionTaskId(activeSession));
    setActiveSession(undefined);
    setIsEndPromptOpen(false);
    setIsCancelPromptOpen(false);
    setTimerState("completed");
    setCompletedMessage("Session saved");
    isEndingSessionRef.current = false;
  };

  const markEndedTaskDone = async () => {
    if (!endedSessionTaskId) {
      return;
    }

    const task = tasks.find((currentTask) => currentTask.id === endedSessionTaskId);
    if (task && !isTaskComplete(task)) {
      await onMarkTaskDone(endedSessionTaskId);
    }
    setEndedSessionTaskId(undefined);
    setCompletedMessage("Task marked done");
  };

  const keepEndedTaskOpen = () => {
    setEndedSessionTaskId(undefined);
  };

  const startAnotherAfterEnd = () => {
    setEndedSessionTaskId(undefined);
    startSession();
  };

  const closeCancelPrompt = () => {
    if (isResolvingCancelRef.current) {
      return;
    }

    setIsCancelPromptOpen(false);
  };

  const resolveCancelSession = async (action: CancelSessionAction) => {
    if (!activeSession || isResolvingCancelRef.current) {
      return;
    }

    const elapsedMs = getElapsedMs(activeSession);
    const elapsedStart = new Date(Date.now() - elapsedMs);
    const elapsedEnd = new Date();
    const categoryId = getSessionCategoryId(activeSession);
    const category = categories.find((currentCategory) => currentCategory.id === categoryId);
    const title = getSessionTitle(activeSession, category);

    isResolvingCancelRef.current = true;
    clearPersistedFocusSession();
    hasSavedSessionRef.current = false;

    if (action !== "discard" && elapsedMs >= 60000) {
      // Canceled focus records use measured focused time, excluding pauses,
      // so partial and abandoned blocks do not overstate productive duration.
      await onCompleteSession({
        title,
        notes:
          action === "partial"
            ? "Partial Pomodoro focus session"
            : "Abandoned Pomodoro focus session",
        taskId: getSessionTaskId(activeSession),
        categoryId,
        startsAt: elapsedStart.toISOString(),
        endsAt: elapsedEnd.toISOString(),
        isAllDay: false,
        kind: getSessionKind(activeSession, category),
        outcome: action === "partial" ? "active" : "abandoned",
        source: "pomodoro",
        recurrenceFrequency: "none",
      });
    }

    setActiveSession(undefined);
    setIsCancelPromptOpen(false);
    setIsEndPromptOpen(false);
    setEndedSessionTaskId(undefined);
    setRemainingSeconds(durationMinutes * 60);
    setTimerState("idle");
    setCompletedMessage(
      action === "discard"
        ? "Session discarded"
        : elapsedMs < 60000
          ? "Session discarded because it was under 1 minute."
          : action === "partial"
            ? "Partial session saved"
            : "Session marked abandoned",
    );
    isResolvingCancelRef.current = false;
  };

  return (
    <section className="focus-panel">
      <div className="task-detail-section-header">
        <div>
          <h3>Focus session</h3>
          <span>Creates a completed pomodoro time block</span>
        </div>
      </div>

      <div
        className={`focus-timer-display focus-timer-ring-display${
          isBreakSurface ? " break-mode" : ""
        } ${timerVisualState}`}
        aria-live="polite"
      >
        <div
          aria-label={`${timerModeLabel}: ${formatRemainingTime(
            visibleRemainingSeconds,
          )}, ${timerProgressPercent}% complete`}
          className="focus-progress-ring"
          role="img"
        >
          <svg
            aria-hidden="true"
            className="focus-progress-ring-svg"
            viewBox="0 0 190 190"
          >
            <circle
              className="focus-progress-ring-track"
              cx="95"
              cy="95"
              r={timerRingRadius}
            />
            <circle
              className="focus-progress-ring-value"
              cx="95"
              cy="95"
              r={timerRingRadius}
              strokeDasharray={timerRingCircumference}
              strokeDashoffset={timerRingOffset}
            />
          </svg>
          <div className="focus-progress-ring-center">
            <span>{timerModeLabel}</span>
            <strong>{formatRemainingTime(visibleRemainingSeconds)}</strong>
          </div>
        </div>
      </div>
      {timerState === "paused" ? (
        <div className="focus-status-indicator">Paused</div>
      ) : null}
      {breakTimerState === "running" ? (
        <div className="focus-status-indicator">Break</div>
      ) : breakTimerState === "paused" ? (
        <div className="focus-status-indicator">Break paused</div>
      ) : breakTimerState === "completed" ? (
        <div className="focus-status-indicator">Break complete</div>
      ) : null}
      {cycleEnabled ? (
        <div className="focus-cycle-status">
          Session {cyclePosition} of {cycleLongBreakAfter} before long break.
        </div>
      ) : null}

      {!isBreakSurface ? (
        <div className="focus-form-grid">
          <label>
            <span>{activeTask ? "Task" : "Title"}</span>
            {activeTask ? (
              <select
                disabled={hasLockedTimer}
                onChange={(event) => {
                  const nextTask = tasks.find(
                    (task) => task.id === event.target.value,
                  );
                  setSelectedTaskId(event.target.value);
                  if (nextTask) {
                    setSelectedCategoryId(nextTask.categoryId);
                    setSelectedBlockKind("task-session");
                    setCustomFocusTitle("");
                  } else {
                    setSelectedBlockKind(
                      getDefaultPomodoroBlockKind(undefined, activeCategory),
                    );
                  }
                }}
                value={selectedTaskId}
              >
                <option value="">Custom title</option>
                {selectableTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            ) : (
              <input
                disabled={hasLockedTimer}
                onChange={(event) => setCustomFocusTitle(event.target.value)}
                placeholder="Focus session"
                value={customFocusTitle}
              />
            )}
          </label>

          <div className="focus-choice-field">
            <span>Category</span>
            <div className="focus-category-choice-list" role="group" aria-label="Focus category">
              {categories.map((category) => {
                const colors = getCategoryColorValues(category.color);
                const isSelected =
                  (activeTask?.categoryId || selectedCategoryId) === category.id;
                return (
                  <button
                    aria-pressed={isSelected}
                    className={`focus-category-choice${isSelected ? " active" : ""}`}
                    disabled={hasLockedTimer || taskProvidesCategory}
                    key={category.id}
                    onClick={() => {
                      setSelectedCategoryId(category.id);
                      if (!activeTask) {
                        setSelectedBlockKind(
                          getDefaultPomodoroBlockKind(undefined, category),
                        );
                      }
                    }}
                    style={
                      {
                        "--focus-category-accent": colors.accent,
                        "--focus-category-background": colors.background,
                        "--focus-category-border": colors.border,
                      } as CSSProperties
                    }
                    type="button"
                  >
                    <span aria-hidden="true" />
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="focus-choice-field">
            <span>Type</span>
            <SegmentedControl
              ariaLabel="Focus block type"
              compact
              onChange={setSelectedBlockKind}
              options={blockKindOptions.map((option) => ({
                ...option,
                disabled: hasLockedTimer,
              }))}
              value={selectedBlockKind}
            />
          </div>

          {!cycleEnabled ? (
            <div className="focus-choice-field">
              <span>Duration</span>
              <SegmentedControl
                ariaLabel="Focus duration"
                compact
                onChange={(value) => setDurationPreset(Number(value))}
                options={durationOptions.map((option) => ({
                  ...option,
                  value: `${option.value}`,
                  disabled: hasLockedTimer,
                }))}
                value={`${durationPreset}`}
              />
            </div>
          ) : null}

          {!cycleEnabled && durationPreset === 0 ? (
            <label>
              <span>Minutes</span>
              <input
                disabled={hasLockedTimer}
                max={240}
                min={1}
                onChange={(event) =>
                  setCustomDuration(Math.max(1, Number(event.target.value)))
                }
                type="number"
                value={customDuration}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="focus-actions">
        {breakTimerState === "running" ? (
          <>
            <button className="toolbar-button" onClick={pauseBreak} type="button">
              Pause
            </button>
            <button
              className="toolbar-button danger-action"
              onClick={endBreak}
              type="button"
            >
              End break
            </button>
          </>
        ) : breakTimerState === "paused" ? (
          <>
            <button
              className="toolbar-button primary-action"
              onClick={resumeBreak}
              type="button"
            >
              Resume
            </button>
            <button
              className="toolbar-button danger-action"
              onClick={endBreak}
              type="button"
            >
              End break
            </button>
          </>
        ) : breakTimerState === "completed" ? (
          <>
            <button
              className="toolbar-button primary-action"
              disabled={!canStart}
              onClick={startSession}
              type="button"
            >
              {cycleEnabled ? "Start next focus" : "Start focus"}
            </button>
            {cycleEnabled ? (
              <button
                className="toolbar-button danger-action"
                onClick={endCycleMode}
                type="button"
              >
                End cycle
              </button>
            ) : (
              <button className="toolbar-button" onClick={finishFocusFlow} type="button">
                Done
              </button>
            )}
          </>
        ) : timerState === "running" ? (
          <>
            <button
              className="toolbar-button"
              onClick={pauseSession}
              type="button"
            >
              Pause
            </button>
            <button
              className="toolbar-button primary-action"
              onClick={endSession}
              type="button"
            >
              End session
            </button>
            <button
              className="toolbar-button danger-action"
              onClick={cancelSession}
              type="button"
            >
              Cancel
            </button>
          </>
        ) : timerState === "paused" ? (
          <>
            <button
              className="toolbar-button primary-action"
              onClick={resumeSession}
              type="button"
            >
              Resume
            </button>
            <button
              className="toolbar-button"
              onClick={endSession}
              type="button"
            >
              End session
            </button>
            <button
              className="toolbar-button danger-action"
              onClick={cancelSession}
              type="button"
            >
              Cancel
            </button>
          </>
        ) : timerState === "idle" ? (
          <button
            className="toolbar-button primary-action"
            disabled={!canStart}
            onClick={startSession}
            type="button"
          >
            Start Focus
          </button>
        ) : null}
        {timerState === "completed" && breakTimerState === "idle" && cycleEnabled ? (
          <>
            <button
              className="toolbar-button primary-action"
              onClick={() => startBreak(nextCycleBreakMinutes)}
              type="button"
            >
              Start {nextCycleBreakMinutes} min break
            </button>
            <button
              className="toolbar-button"
              disabled={!canStart}
              onClick={startSession}
              type="button"
            >
              Skip break
            </button>
            <button
              className="toolbar-button danger-action"
              onClick={endCycleMode}
              type="button"
            >
              End cycle
            </button>
          </>
        ) : timerState === "completed" && breakTimerState === "idle" ? (
          <>
            <button
              className="toolbar-button primary-action"
              onClick={() => startBreak(5)}
              type="button"
            >
              Start 5 min break
            </button>
            <button
              className="toolbar-button"
              onClick={() => startBreak(10)}
              type="button"
            >
              Start 10 min break
            </button>
            <button
              className="toolbar-button"
              disabled={!canStart}
              onClick={startSession}
              type="button"
            >
              Start another focus
            </button>
            <button className="toolbar-button" onClick={finishFocusFlow} type="button">
              Done
            </button>
          </>
        ) : null}
      </div>

      {isCancelPromptOpen && activeSession ? (
        <section
          aria-label="Cancel focus session"
          className="focus-cancel-panel"
        >
          <div>
            <h4>
              You focused for {formatElapsedLabel(cancelElapsedMs)}. Save this
              time?
            </h4>
            <p>
              {canSaveCancelRecord
                ? "Save the focused time, mark the attempt abandoned, or discard it."
                : "This session is under 1 minute, so discarding is recommended."}
            </p>
          </div>
          <div className="focus-cancel-actions">
            <button
              className="toolbar-button danger-action"
              disabled={isResolvingCancelRef.current}
              onClick={() => void resolveCancelSession("discard")}
              type="button"
            >
              Discard
            </button>
            <button
              className="toolbar-button"
              disabled={!canSaveCancelRecord || isResolvingCancelRef.current}
              onClick={() => void resolveCancelSession("abandoned")}
              type="button"
            >
              Mark abandoned
            </button>
            <button
              className="toolbar-button primary-action"
              disabled={!canSaveCancelRecord || isResolvingCancelRef.current}
              onClick={() => void resolveCancelSession("partial")}
              type="button"
            >
              Save partial
            </button>
            <button
              className="toolbar-button"
              disabled={isResolvingCancelRef.current}
              onClick={closeCancelPrompt}
              type="button"
            >
              Keep focusing
            </button>
          </div>
        </section>
      ) : null}

      {isEndPromptOpen && activeSession ? (
        <section aria-label="End focus session" className="focus-cancel-panel">
          <div>
            <h4>
              You focused for {formatElapsedLabel(cancelElapsedMs)}. End and
              save?
            </h4>
            <p>
              This session is under 1 minute. Cancel is recommended unless you
              still want to save a short focus block.
            </p>
          </div>
          <div className="focus-cancel-actions">
            <button
              className="toolbar-button danger-action"
              disabled={isEndingSessionRef.current}
              onClick={cancelSession}
              type="button"
            >
              Cancel instead
            </button>
            <button
              className="toolbar-button"
              disabled={isEndingSessionRef.current}
              onClick={closeEndPrompt}
              type="button"
            >
              Keep focusing
            </button>
            <button
              className="toolbar-button primary-action"
              disabled={isEndingSessionRef.current}
              onClick={() => void saveEndedSession(true)}
              type="button"
            >
              Save anyway
            </button>
          </div>
        </section>
      ) : null}

      {endedSessionTask ? (
        <section aria-label="Finished task follow-up" className="focus-cancel-panel">
          <div>
            <h4>{endedSessionTask.title}</h4>
            <p>Session saved. What should happen to this task?</p>
          </div>
          <div className="focus-cancel-actions">
            <button
              className="toolbar-button primary-action"
              onClick={() => void markEndedTaskDone()}
              type="button"
            >
              Mark task done
            </button>
            <button className="toolbar-button" onClick={keepEndedTaskOpen} type="button">
              Keep task open
            </button>
            <button
              className="toolbar-button"
              disabled={!canStart}
              onClick={startAnotherAfterEnd}
              type="button"
            >
              Start another session
            </button>
          </div>
        </section>
      ) : null}

      <div className="focus-preferences">
        <ToggleRow
          checked={cycleEnabled}
          label="Cycle mode"
          onChange={updateCycleEnabled}
        />
        <ToggleRow
          checked={soundEnabled}
          label="Completion sound"
          onChange={updateSoundPreference}
        />
        <ToggleRow
          checked={notificationEnabled}
          label="Desktop notification"
          onChange={updateNotificationPreference}
        />
      </div>

      {cycleEnabled ? (
        <div className="focus-cycle-settings">
          <label>
            <span>Focus</span>
            <input
              disabled={hasLockedTimer}
              max={240}
              min={1}
              onChange={(event) =>
                updateCycleNumberSetting(
                  Number(event.target.value),
                  1,
                  240,
                  focusCycleFocusMinutesKey,
                  setCycleFocusMinutes,
                )
              }
              type="number"
              value={cycleFocusMinutes}
            />
          </label>
          <label>
            <span>Short break</span>
            <input
              disabled={hasLockedTimer}
              max={60}
              min={1}
              onChange={(event) =>
                updateCycleNumberSetting(
                  Number(event.target.value),
                  1,
                  60,
                  focusCycleShortBreakMinutesKey,
                  setCycleShortBreakMinutes,
                )
              }
              type="number"
              value={cycleShortBreakMinutes}
            />
          </label>
          <label>
            <span>Long break</span>
            <input
              disabled={hasLockedTimer}
              max={120}
              min={1}
              onChange={(event) =>
                updateCycleNumberSetting(
                  Number(event.target.value),
                  1,
                  120,
                  focusCycleLongBreakMinutesKey,
                  setCycleLongBreakMinutes,
                )
              }
              type="number"
              value={cycleLongBreakMinutes}
            />
          </label>
          <label>
            <span>Long after</span>
            <input
              disabled={hasLockedTimer}
              max={12}
              min={1}
              onChange={(event) =>
                updateCycleNumberSetting(
                  Number(event.target.value),
                  1,
                  12,
                  focusCycleLongBreakAfterKey,
                  setCycleLongBreakAfter,
                )
              }
              type="number"
              value={cycleLongBreakAfter}
            />
          </label>
        </div>
      ) : null}

      {completedMessage ? (
        <div className="detail-meta">{completedMessage}</div>
      ) : null}
    </section>
  );
}

export default PomodoroPanel;
