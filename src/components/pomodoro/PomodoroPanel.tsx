import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Task } from "../../types/domain";
import type { CreateTimeBlockInput } from "../../types/plannerApi";
import { isTaskComplete } from "../../utils/tasks";
import { SegmentedControl } from "../ui/ChoiceControls";

type PomodoroPanelProps = {
  categories: Category[];
  selectedTask?: Task;
  tasks: Task[];
  onCompleteSession: (timeBlock: CreateTimeBlockInput) => void | Promise<void>;
};

type TimerState = "idle" | "running" | "completed";

const durationOptions = [
  { label: "25", value: 25 },
  { label: "50", value: 50 },
  { label: "Custom", value: 0 },
];

const formatRemainingTime = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
};

function PomodoroPanel({
  categories,
  selectedTask,
  tasks,
  onCompleteSession,
}: PomodoroPanelProps) {
  const openTasks = useMemo(
    () => tasks.filter((task) => !isTaskComplete(task)),
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
  const [durationPreset, setDurationPreset] = useState(25);
  const [customDuration, setCustomDuration] = useState(25);
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [startedAt, setStartedAt] = useState<Date>();
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [completedMessage, setCompletedMessage] = useState("");
  const hasSavedSessionRef = useRef(false);

  const activeTask = tasks.find((task) => task.id === selectedTaskId);
  const durationMinutes = durationPreset === 0 ? customDuration : durationPreset;
  const canStart = durationMinutes > 0 && Boolean(activeTask || selectedCategoryId);
  const taskProvidesCategory = Boolean(activeTask?.categoryId);

  useEffect(() => {
    if (timerState === "running") {
      return;
    }

    setSelectedTaskId(selectedTask?.id ?? "");
    setSelectedCategoryId(selectedTask?.categoryId ?? categories[0]?.id ?? "");
  }, [categories, selectedTask, timerState]);

  useEffect(() => {
    if (timerState !== "idle") {
      return;
    }

    setRemainingSeconds(Math.max(1, durationMinutes) * 60);
  }, [durationMinutes, timerState]);

  useEffect(() => {
    if (timerState !== "running" || !startedAt) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const elapsedSeconds = Math.floor(
        (Date.now() - startedAt.getTime()) / 1000,
      );
      setRemainingSeconds(Math.max(durationMinutes * 60 - elapsedSeconds, 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [durationMinutes, startedAt, timerState]);

  useEffect(() => {
    if (
      timerState !== "running" ||
      remainingSeconds > 0 ||
      !startedAt ||
      hasSavedSessionRef.current
    ) {
      return;
    }

    const completedAt = new Date();
    const categoryId = activeTask?.categoryId || selectedCategoryId;
    hasSavedSessionRef.current = true;
    setTimerState("completed");
    setCompletedMessage("Session saved");
    void onCompleteSession({
      title: activeTask?.title ?? "Focus session",
      notes: "Pomodoro focus session",
      taskId: activeTask?.id,
      categoryId,
      startsAt: startedAt.toISOString(),
      endsAt: completedAt.toISOString(),
      isAllDay: false,
      kind: "task-session",
      outcome: "active",
      source: "pomodoro",
      recurrenceFrequency: "none",
    });
  }, [
    activeTask,
    onCompleteSession,
    remainingSeconds,
    selectedCategoryId,
    startedAt,
    timerState,
  ]);

  const startSession = () => {
    if (!canStart) {
      return;
    }

    setCompletedMessage("");
    hasSavedSessionRef.current = false;
    setStartedAt(new Date());
    setRemainingSeconds(durationMinutes * 60);
    setTimerState("running");
  };

  const cancelSession = () => {
    setStartedAt(undefined);
    hasSavedSessionRef.current = false;
    setRemainingSeconds(durationMinutes * 60);
    setTimerState("idle");
    setCompletedMessage("Session canceled");
  };

  const resetSession = () => {
    setStartedAt(undefined);
    hasSavedSessionRef.current = false;
    setRemainingSeconds(durationMinutes * 60);
    setTimerState("idle");
  };

  return (
    <section className="focus-panel">
      <div className="task-detail-section-header">
        <div>
          <h3>Focus session</h3>
          <span>Creates a completed pomodoro time block</span>
        </div>
      </div>

      <div className="focus-timer-display" aria-live="polite">
        {formatRemainingTime(remainingSeconds)}
      </div>

      <div className="focus-form-grid">
        <label>
          <span>Task</span>
          <select
            disabled={timerState === "running"}
            onChange={(event) => {
              const nextTask = tasks.find((task) => task.id === event.target.value);
              setSelectedTaskId(event.target.value);
              if (nextTask) {
                setSelectedCategoryId(nextTask.categoryId);
              }
            }}
            value={selectedTaskId}
          >
            <option value="">No task</option>
            {selectableTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Category</span>
          <select
            disabled={timerState === "running" || taskProvidesCategory}
            onChange={(event) => setSelectedCategoryId(event.target.value)}
            value={activeTask?.categoryId || selectedCategoryId}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <div className="focus-choice-field">
          <span>Duration</span>
          <SegmentedControl
            ariaLabel="Focus duration"
            compact
            onChange={(value) => setDurationPreset(Number(value))}
            options={durationOptions.map((option) => ({
              ...option,
              value: `${option.value}`,
              disabled: timerState === "running",
            }))}
            value={`${durationPreset}`}
          />
        </div>

        {durationPreset === 0 ? (
          <label>
            <span>Minutes</span>
            <input
              disabled={timerState === "running"}
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

      <div className="focus-actions">
        {timerState === "running" ? (
          <button
            className="toolbar-button danger-action"
            onClick={cancelSession}
            type="button"
          >
            Cancel
          </button>
        ) : (
          <button
            className="toolbar-button primary-action"
            disabled={!canStart}
            onClick={startSession}
            type="button"
          >
            Start Focus
          </button>
        )}
        {timerState === "completed" ? (
          <button className="toolbar-button" onClick={resetSession} type="button">
            Reset
          </button>
        ) : null}
      </div>

      {completedMessage ? (
        <div className="detail-meta">{completedMessage}</div>
      ) : null}
    </section>
  );
}

export default PomodoroPanel;
