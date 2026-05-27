import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Category, Task, TimeBlockKind } from "../../types/domain";
import type { CreateTimeBlockInput } from "../../types/plannerApi";
import { getCategoryColorValues } from "../../utils/calendar";
import { isTaskComplete, orderTasksByDueDate } from "../../utils/tasks";
import { SegmentedControl } from "../ui/ChoiceControls";

type TimerPanelProps = {
  categories: Category[];
  selectedTask?: Task;
  tasks: Task[];
  onCompleteSession: (timeBlock: CreateTimeBlockInput) => void | Promise<void>;
};

type TimerState = "idle" | "running" | "confirm-short" | "saved";

type PersistedTimerSession = {
  version: 1;
  startedAt: string;
  taskId?: string;
  categoryId: string;
  kind?: TimeBlockKind;
  title?: string;
};

const activeTimerSessionKey = "planner:activeTimerSession";

const blockKindOptions: Array<{ value: TimeBlockKind; label: string }> = [
  { value: "event", label: "Event" },
  { value: "task-session", label: "Task session" },
  { value: "habit", label: "Habit" },
  { value: "routine", label: "Routine" },
];

const isTimeBlockKind = (value: unknown): value is TimeBlockKind =>
  blockKindOptions.some((option) => option.value === value);

const isPersistedTimerSession = (
  value: unknown,
): value is PersistedTimerSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<PersistedTimerSession>;
  return (
    session.version === 1 &&
    typeof session.startedAt === "string" &&
    typeof session.categoryId === "string" &&
    (!session.taskId || typeof session.taskId === "string") &&
    (!session.kind || isTimeBlockKind(session.kind)) &&
    (!session.title || typeof session.title === "string")
  );
};

const readPersistedTimerSession = () => {
  try {
    const storedSession = localStorage.getItem(activeTimerSessionKey);
    if (!storedSession) {
      return undefined;
    }

    const parsedSession = JSON.parse(storedSession) as unknown;
    return isPersistedTimerSession(parsedSession) ? parsedSession : undefined;
  } catch {
    return undefined;
  }
};

const writePersistedTimerSession = (session: PersistedTimerSession) => {
  try {
    localStorage.setItem(activeTimerSessionKey, JSON.stringify(session));
  } catch {
    // Timer recovery is best-effort.
  }
};

const clearPersistedTimerSession = () => {
  try {
    localStorage.removeItem(activeTimerSessionKey);
  } catch {
    // Timer recovery is best-effort.
  }
};

const getElapsedMs = (session: PersistedTimerSession, nowMs = Date.now()) =>
  Math.max(0, nowMs - new Date(session.startedAt).getTime());

const formatElapsedTime = (elapsedMs: number) => {
  const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

const formatElapsedLabel = (elapsedMs: number) => {
  const totalMinutes = Math.max(0, Math.floor(elapsedMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return "under 1m";
};

const getDefaultTimerBlockKind = (
  task: Task | undefined,
  category: Category | undefined,
): TimeBlockKind => {
  if (task) {
    return "task-session";
  }

  return category?.defaultBlockKind ?? "event";
};

function TimerPanel({
  categories,
  selectedTask,
  tasks,
  onCompleteSession,
}: TimerPanelProps) {
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
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    selectedTask?.categoryId ?? categories[0]?.id ?? "",
  );
  const [selectedBlockKind, setSelectedBlockKind] = useState<TimeBlockKind>(
    getDefaultTimerBlockKind(selectedTask, categories[0]),
  );
  const [customTimerTitle, setCustomTimerTitle] = useState("");
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [activeSession, setActiveSession] = useState<PersistedTimerSession>();
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pendingEndAt, setPendingEndAt] = useState<Date>();
  const [statusMessage, setStatusMessage] = useState("");
  const hasRestoredSessionRef = useRef(false);
  const isSavingRef = useRef(false);

  const activeTask = tasks.find((task) => task.id === selectedTaskId);
  const taskProvidesCategory = Boolean(activeTask?.categoryId);
  const categoryId = activeTask?.categoryId || selectedCategoryId;
  const category = categories.find(
    (currentCategory) => currentCategory.id === categoryId,
  );
  const categoryTitle = category?.name ?? "Timed session";
  const customTitle = customTimerTitle.trim();
  const sessionTitle = activeTask?.title ?? (customTitle || categoryTitle);
  const canStart = Boolean(activeTask || selectedCategoryId);
  const hasActiveSession = timerState === "running" || timerState === "confirm-short";

  useEffect(() => {
    if (hasRestoredSessionRef.current) {
      return;
    }

    const restoredSession = readPersistedTimerSession();
    hasRestoredSessionRef.current = true;
    if (!restoredSession) {
      return;
    }

    setActiveSession(restoredSession);
    setTimerState("running");
    setSelectedTaskId(restoredSession.taskId ?? "");
    setSelectedCategoryId(restoredSession.categoryId);
    setSelectedBlockKind(
      restoredSession.kind ??
        getDefaultTimerBlockKind(
          tasks.find((task) => task.id === restoredSession.taskId),
          categories.find((category) => category.id === restoredSession.categoryId),
        ),
    );
    setCustomTimerTitle(restoredSession.taskId ? "" : restoredSession.title ?? "");
    setElapsedMs(getElapsedMs(restoredSession));
    setStatusMessage("Restored active timer.");
  }, [categories, tasks]);

  useEffect(() => {
    if (hasActiveSession) {
      return;
    }

    setSelectedTaskId(selectedTask?.id ?? "");
    setSelectedCategoryId(selectedTask?.categoryId ?? categories[0]?.id ?? "");
    setSelectedBlockKind(
      getDefaultTimerBlockKind(
        selectedTask,
        categories.find(
          (category) => category.id === (selectedTask?.categoryId ?? categories[0]?.id),
        ),
      ),
    );
    if (selectedTask) {
      setCustomTimerTitle("");
    }
  }, [categories, hasActiveSession, selectedTask]);

  useEffect(() => {
    if (!activeSession || timerState !== "running") {
      return undefined;
    }

    const updateElapsed = () => setElapsedMs(getElapsedMs(activeSession));
    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [activeSession, timerState]);

  const startTimer = () => {
    if (!canStart) {
      return;
    }

    const session: PersistedTimerSession = {
      version: 1,
      startedAt: new Date().toISOString(),
      taskId: activeTask?.id,
      categoryId,
      kind: selectedBlockKind,
      title: sessionTitle,
    };
    writePersistedTimerSession(session);
    setActiveSession(session);
    setElapsedMs(0);
    setPendingEndAt(undefined);
    setStatusMessage("");
    setTimerState("running");
    isSavingRef.current = false;
  };

  const saveTimerSession = async (endDate = new Date()) => {
    if (!activeSession || isSavingRef.current) {
      return;
    }

    const savedCategoryId = activeTask?.categoryId || activeSession.categoryId;
    const savedCategory = categories.find(
      (currentCategory) => currentCategory.id === savedCategoryId,
    );
    const title =
      activeTask?.title ??
      activeSession.title ??
      savedCategory?.name ??
      "Timed session";

    isSavingRef.current = true;
    clearPersistedTimerSession();
    try {
      await onCompleteSession({
        title,
        notes: "Timer session",
        taskId: activeTask?.id,
        categoryId: savedCategoryId,
        startsAt: activeSession.startedAt,
        endsAt: endDate.toISOString(),
        isAllDay: false,
        kind: activeSession.kind ?? getDefaultTimerBlockKind(activeTask, savedCategory),
        outcome: "active",
        source: "timer",
        recurrenceFrequency: "none",
      });

      setActiveSession(undefined);
      setElapsedMs(0);
      setPendingEndAt(undefined);
      setTimerState("saved");
      setStatusMessage("Timer session saved.");
    } finally {
      isSavingRef.current = false;
    }
  };

  const endTimer = () => {
    if (!activeSession) {
      return;
    }

    const endedAt = new Date();
    const currentElapsedMs = getElapsedMs(activeSession, endedAt.getTime());
    setElapsedMs(currentElapsedMs);
    if (currentElapsedMs < 60000) {
      setPendingEndAt(endedAt);
      setTimerState("confirm-short");
      return;
    }

    void saveTimerSession(endedAt);
  };

  const continueTiming = () => {
    setPendingEndAt(undefined);
    setTimerState("running");
  };

  return (
    <section className="focus-panel timer-panel">
      <div className="task-detail-section-header">
        <div>
          <h3>Timer session</h3>
          <span>Creates a time block from elapsed time</span>
        </div>
      </div>

      <div className={`timer-display ${timerState}`}>
        <span>{timerState === "running" ? "Tracking" : "Ready"}</span>
        <strong>{formatElapsedTime(elapsedMs)}</strong>
        <small>{hasActiveSession ? sessionTitle : "Start when work begins"}</small>
      </div>

      {statusMessage ? (
        <div className="focus-status-indicator">{statusMessage}</div>
      ) : null}

      <div className="focus-form-grid">
        <label>
          <span>{activeTask ? "Task" : "Title"}</span>
          {activeTask ? (
            <select
              disabled={hasActiveSession}
              onChange={(event) => {
                const nextTask = tasks.find(
                  (task) => task.id === event.target.value,
                );
                setSelectedTaskId(event.target.value);
                if (nextTask) {
                  setSelectedCategoryId(nextTask.categoryId);
                  setSelectedBlockKind("task-session");
                  setCustomTimerTitle("");
                } else {
                  setSelectedBlockKind(
                    getDefaultTimerBlockKind(undefined, category),
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
              disabled={hasActiveSession}
              onChange={(event) => setCustomTimerTitle(event.target.value)}
              placeholder="Timed session"
              value={customTimerTitle}
            />
          )}
        </label>

        <div className="focus-choice-field">
          <span>Category</span>
          <div className="focus-category-choice-list" role="group" aria-label="Timer category">
            {categories.map((currentCategory) => {
              const colors = getCategoryColorValues(currentCategory.color);
              const isSelected =
                (activeTask?.categoryId || selectedCategoryId) === currentCategory.id;
              return (
                <button
                  aria-pressed={isSelected}
                  className={`focus-category-choice${isSelected ? " active" : ""}`}
                  disabled={hasActiveSession || taskProvidesCategory}
                  key={currentCategory.id}
                  onClick={() => {
                    setSelectedCategoryId(currentCategory.id);
                    if (!activeTask) {
                      setSelectedBlockKind(
                        getDefaultTimerBlockKind(undefined, currentCategory),
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
                  {currentCategory.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="focus-choice-field">
          <span>Type</span>
          <SegmentedControl
            ariaLabel="Timer block type"
            compact
            onChange={setSelectedBlockKind}
            options={blockKindOptions.map((option) => ({
              ...option,
              disabled: hasActiveSession,
            }))}
            value={selectedBlockKind}
          />
        </div>
      </div>

      <div className="focus-actions">
        {timerState === "running" ? (
          <button
            className="toolbar-button primary-action"
            onClick={endTimer}
            type="button"
          >
            End & Save
          </button>
        ) : timerState === "confirm-short" ? (
          <>
            <button
              className="toolbar-button primary-action"
              onClick={() => void saveTimerSession(pendingEndAt)}
              type="button"
            >
              Save anyway
            </button>
            <button className="toolbar-button" onClick={continueTiming} type="button">
              Continue timing
            </button>
          </>
        ) : (
          <button
            className="toolbar-button primary-action"
            disabled={!canStart}
            onClick={startTimer}
            type="button"
          >
            Start Timer
          </button>
        )}
      </div>

      {timerState === "confirm-short" ? (
        <div className="focus-inline-dialog">
          <h4>Save this short session?</h4>
          <p>
            You tracked {formatElapsedLabel(elapsedMs)}. Continue timing or save it
            now.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export default TimerPanel;
