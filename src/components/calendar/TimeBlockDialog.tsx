import { useState } from "react";
import type {
  Category,
  RecurrenceEndMode,
  RecurrenceFrequency,
  Task,
  TimeBlock,
} from "../../types/domain";
import type { CreateTimeBlockInput } from "../../types/plannerApi";
import { isTaskComplete } from "../../utils/tasks";

type TimeBlockDialogProps = {
  categories: Category[];
  tasks: Task[];
  block?: TimeBlock;
  initialBlock?: CreateTimeBlockInput;
  onClose: () => void;
  onSave: (input: CreateTimeBlockInput | TimeBlock) => void | Promise<void>;
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toOptionalDateInputValue = (value?: string) =>
  value ? toDateInputValue(new Date(value)) : "";

const toTimeInputValue = (date: Date) => {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
};

const weekdayOptions = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const minimumBlockMinutes = 15;

function TimeBlockDialog({
  categories,
  tasks,
  block,
  initialBlock,
  onClose,
  onSave,
}: TimeBlockDialogProps) {
  const formBlock = block ?? initialBlock;
  const startsAt = formBlock ? new Date(formBlock.startsAt) : new Date();
  const endsAt = formBlock ? new Date(formBlock.endsAt) : new Date(startsAt);
  if (!formBlock) {
    startsAt.setHours(9, 0, 0, 0);
    endsAt.setHours(10, 0, 0, 0);
  }
  const linkedTask = formBlock?.taskId
    ? tasks.find((task) => task.id === formBlock.taskId)
    : undefined;
  const openTasks = tasks.filter((task) => !isTaskComplete(task));

  const [title, setTitle] = useState(formBlock?.title ?? "");
  const [notes, setNotes] = useState(formBlock?.notes ?? "");
  const [categoryId, setCategoryId] = useState(
    linkedTask?.categoryId ?? formBlock?.categoryId ?? categories[0]?.id ?? "",
  );
  const [taskId, setTaskId] = useState(
    linkedTask && !isTaskComplete(linkedTask) ? linkedTask.id : "",
  );
  const [date, setDate] = useState(toDateInputValue(startsAt));
  const [endDate, setEndDate] = useState(toDateInputValue(endsAt));
  const [startTime, setStartTime] = useState(toTimeInputValue(startsAt));
  const [endTime, setEndTime] = useState(toTimeInputValue(endsAt));
  const [recurrenceFrequency, setRecurrenceFrequency] =
    useState<RecurrenceFrequency>(formBlock?.recurrenceFrequency ?? "none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(
    `${formBlock?.recurrenceInterval ?? 1}`,
  );
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>(
    formBlock?.recurrenceWeekdays?.length
      ? formBlock.recurrenceWeekdays
      : [startsAt.getDay()],
  );
  const [recurrenceEndMode, setRecurrenceEndMode] =
    useState<RecurrenceEndMode>(
      formBlock?.recurrenceEndMode ??
        (formBlock?.recurrenceEndDate ? "on" : "never"),
    );
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    toOptionalDateInputValue(formBlock?.recurrenceEndDate),
  );
  const [recurrenceCount, setRecurrenceCount] = useState(
    `${formBlock?.recurrenceCount ?? 10}`,
  );

  const toggleRecurrenceWeekday = (weekday: number) => {
    setRecurrenceWeekdays((currentWeekdays) => {
      if (currentWeekdays.includes(weekday)) {
        const nextWeekdays = currentWeekdays.filter((day) => day !== weekday);
        return nextWeekdays.length > 0 ? nextWeekdays : currentWeekdays;
      }

      return [...currentWeekdays, weekday].sort();
    });
  };

  const handleStartDateChange = (nextDate: string) => {
    setDate(nextDate);
    if (endDate < nextDate) {
      setEndDate(nextDate);
    }
  };

  const handleTaskChange = (nextTaskId: string) => {
    setTaskId(nextTaskId);
    const nextTask = openTasks.find((task) => task.id === nextTaskId);
    if (nextTask) {
      setCategoryId(nextTask.categoryId);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !categoryId) {
      return;
    }

    const nextStartsAt = new Date(`${date}T${startTime}:00`);
    const nextEndsAt = new Date(`${endDate}T${endTime}:00`);
    if (nextEndsAt <= nextStartsAt) {
      nextEndsAt.setDate(nextEndsAt.getDate() + 1);
    }
    const minimumEndsAt = new Date(
      nextStartsAt.getTime() + minimumBlockMinutes * 60000,
    );
    if (nextEndsAt < minimumEndsAt) {
      nextEndsAt.setTime(minimumEndsAt.getTime());
    }
    const normalizedInterval = Math.max(1, Number.parseInt(recurrenceInterval, 10) || 1);
    const normalizedCount = Math.max(1, Number.parseInt(recurrenceCount, 10) || 1);
    const isRepeating = recurrenceFrequency !== "none";
    const selectedTask = openTasks.find((task) => task.id === taskId);

    await onSave({
      id: block?.id,
      title: title.trim(),
      notes,
      categoryId: selectedTask?.categoryId ?? categoryId,
      taskId: taskId || undefined,
      startsAt: nextStartsAt.toISOString(),
      endsAt: nextEndsAt.toISOString(),
      recurrenceFrequency,
      recurrenceInterval: isRepeating ? normalizedInterval : undefined,
      recurrenceWeekdays:
        recurrenceFrequency === "weekly" ? recurrenceWeekdays : undefined,
      recurrenceEndMode: isRepeating ? recurrenceEndMode : "never",
      recurrenceEndDate:
        !isRepeating || recurrenceEndMode !== "on" || !recurrenceEndDate
          ? undefined
          : new Date(`${recurrenceEndDate}T23:59:59`).toISOString(),
      recurrenceCount:
        isRepeating && recurrenceEndMode === "after"
          ? normalizedCount
          : undefined,
    });
    onClose();
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-label={block ? "Edit Time Block" : "New Time Block"}
        className="fake-dialog"
      >
        <div className="fake-dialog-header">
          <div>
            <div className="panel-kicker">Calendar block</div>
            <h2>{block ? "Edit Time Block" : "New Time Block"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="dialog-form-grid">
          <label>
            <span>Title</span>
            <input
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <label>
            <span>Category</span>
            <select
              onChange={(event) => setCategoryId(event.target.value)}
              value={categoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input
              onChange={(event) => handleStartDateChange(event.target.value)}
              type="date"
              value={date}
            />
          </label>
          <label>
            <span>Block end date</span>
            <input
              onChange={(event) => setEndDate(event.target.value)}
              type="date"
              value={endDate}
            />
          </label>
          <label>
            <span>Start</span>
            <input
              onChange={(event) => setStartTime(event.target.value)}
              step={minimumBlockMinutes * 60}
              type="time"
              value={startTime}
            />
          </label>
          <label>
            <span>End</span>
            <input
              onChange={(event) => setEndTime(event.target.value)}
              step={minimumBlockMinutes * 60}
              type="time"
              value={endTime}
            />
          </label>
          <label>
            <span>Linked task</span>
            <select
              onChange={(event) => handleTaskChange(event.target.value)}
              value={taskId}
            >
              <option value="">No linked task</option>
              {openTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Repeats</span>
            <select
              onChange={(event) =>
                setRecurrenceFrequency(
                  event.target.value as RecurrenceFrequency,
                )
              }
              value={recurrenceFrequency}
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label>
            <span>Every</span>
            <input
              disabled={recurrenceFrequency === "none"}
              min={1}
              onChange={(event) => setRecurrenceInterval(event.target.value)}
              type="number"
              value={recurrenceInterval}
            />
          </label>
          {recurrenceFrequency === "weekly" ? (
            <fieldset className="dialog-wide-field recurrence-weekdays">
              <legend>Repeat on</legend>
              <div>
                {weekdayOptions.map((weekday) => (
                  <button
                    className={
                      recurrenceWeekdays.includes(weekday.value) ? "active" : ""
                    }
                    key={weekday.value}
                    onClick={() => toggleRecurrenceWeekday(weekday.value)}
                    type="button"
                  >
                    {weekday.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}
          <label>
            <span>Ends</span>
            <select
              disabled={recurrenceFrequency === "none"}
              onChange={(event) =>
                setRecurrenceEndMode(event.target.value as RecurrenceEndMode)
              }
              value={recurrenceEndMode}
            >
              <option value="never">Never</option>
              <option value="on">On date</option>
              <option value="after">After count</option>
            </select>
          </label>
          <label>
            <span>Repeat until</span>
            <input
              disabled={
                recurrenceFrequency === "none" || recurrenceEndMode !== "on"
              }
              onChange={(event) => setRecurrenceEndDate(event.target.value)}
              type="date"
              value={recurrenceEndDate}
            />
          </label>
          <label>
            <span>Count</span>
            <input
              disabled={
                recurrenceFrequency === "none" || recurrenceEndMode !== "after"
              }
              min={1}
              onChange={(event) => setRecurrenceCount(event.target.value)}
              type="number"
              value={recurrenceCount}
            />
          </label>
          <label className="dialog-wide-field">
            <span>Notes</span>
            <textarea
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              value={notes}
            />
          </label>
        </div>

        <div className="fake-dialog-actions">
          <button className="toolbar-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="toolbar-button primary-action"
            onClick={handleSave}
            type="button"
          >
            Save Block
          </button>
        </div>
      </section>
    </div>
  );
}

export default TimeBlockDialog;
