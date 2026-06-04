import { useState } from "react";
import type {
  Category,
  RecurrenceEndMode,
  RecurrenceFrequency,
  Task,
  TimeBlock,
  TimeBlockKind,
  TimeBlockOutcome,
} from "../../types/domain";
import type { CreateTimeBlockInput } from "../../types/plannerApi";
import { isTaskComplete } from "../../utils/tasks";
import { SegmentedControl, ToggleRow } from "../ui/ChoiceControls";
import {
  getZonedDateInputValue,
  resolveZonedDateTime,
  toDateInputValue,
  toTimeInputValue,
  toZonedCalendarDate,
  type AmbiguousTimeChoice,
} from "../../utils/timezone";

type TimeBlockDialogProps = {
  categories: Category[];
  tasks: Task[];
  block?: TimeBlock;
  initialBlock?: CreateTimeBlockInput;
  onClose: () => void;
  onSave: (input: CreateTimeBlockInput | TimeBlock) => void | Promise<void>;
  primaryTimeZone: string;
  timeZones: string[];
};

const toOptionalDateInputValue = (value: string | undefined, timeZone: string) =>
  value ? getZonedDateInputValue(value, timeZone) : "";

const getAllDayEndInputValue = (date: Date) => {
  const inclusiveEndDate = new Date(date);
  inclusiveEndDate.setDate(inclusiveEndDate.getDate() - 1);
  return toDateInputValue(inclusiveEndDate);
};

const getStartOfDay = (dateValue: string) => new Date(`${dateValue}T00:00:00`);

const getNextDayStart = (dateValue: string) => {
  const date = getStartOfDay(dateValue);
  date.setDate(date.getDate() + 1);
  return date;
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

const blockKindOptions: Array<{ value: TimeBlockKind; label: string }> = [
  { value: "event", label: "Event" },
  { value: "task-session", label: "Task" },
  { value: "habit", label: "Habit" },
  { value: "routine", label: "Routine" },
];

const blockOutcomeOptions: Array<{ value: TimeBlockOutcome; label: string }> = [
  { value: "active", label: "Normal" },
  { value: "abandoned", label: "Abandoned" },
];

const sourceLabels: Record<TimeBlock["source"], string> = {
  manual: "Manual",
  pomodoro: "Pomodoro",
  timer: "Timer",
  generated: "Generated",
  imported: "Imported",
};

const blockKindHelperText: Partial<Record<TimeBlockKind, string>> = {
  habit: "Use habit blocks for repeatable practice and consistency.",
  routine: "Use routine blocks for regular life patterns like sleep, meals, and shutdown rituals.",
};

function TimeBlockDialog({
  categories,
  tasks,
  block,
  initialBlock,
  onClose,
  onSave,
  primaryTimeZone,
  timeZones,
}: TimeBlockDialogProps) {
  const isCreating = !block;
  const formBlock = block ?? initialBlock;
  const initialTimeZone = formBlock?.timeZone ?? primaryTimeZone;
  const startsAt = formBlock
    ? toZonedCalendarDate(formBlock.startsAt, initialTimeZone)
    : toZonedCalendarDate(new Date(), initialTimeZone);
  const endsAt = formBlock
    ? toZonedCalendarDate(formBlock.endsAt, initialTimeZone)
    : new Date(startsAt);
  if (!formBlock) {
    startsAt.setHours(9, 0, 0, 0);
    endsAt.setHours(10, 0, 0, 0);
  }
  const linkedTask = formBlock?.taskId
    ? tasks.find((task) => task.id === formBlock.taskId)
    : undefined;
  const openTasks = tasks.filter((task) => !isTaskComplete(task));
  const initialCategoryId =
    linkedTask?.categoryId ?? formBlock?.categoryId ?? categories[0]?.id ?? "";
  const initialCategory = categories.find(
    (category) => category.id === initialCategoryId,
  );

  const [title, setTitle] = useState(
    isCreating && linkedTask ? linkedTask.title : formBlock?.title ?? "",
  );
  const [notes, setNotes] = useState(formBlock?.notes ?? "");
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [outcome, setOutcome] = useState<TimeBlockOutcome>(
    formBlock?.outcome ?? "active",
  );
  const [kind, setKind] = useState<TimeBlockKind>(
    formBlock?.kind ?? initialCategory?.defaultBlockKind ?? "event",
  );
  const [source] = useState<TimeBlock["source"]>(
    formBlock?.source ?? "manual",
  );
  const [timeZone, setTimeZone] = useState(initialTimeZone);
  const [ambiguousTimeChoice, setAmbiguousTimeChoice] =
    useState<AmbiguousTimeChoice>();
  const [hasAmbiguousDateTime, setHasAmbiguousDateTime] = useState(false);
  const [dateTimeError, setDateTimeError] = useState<string>();
  const [taskId, setTaskId] = useState(
    linkedTask && !isTaskComplete(linkedTask) ? linkedTask.id : "",
  );
  const [date, setDate] = useState(toDateInputValue(startsAt));
  const [endDate, setEndDate] = useState(
    formBlock?.isAllDay
      ? getAllDayEndInputValue(endsAt)
      : toDateInputValue(endsAt),
  );
  const [isAllDay, setIsAllDay] = useState(Boolean(formBlock?.isAllDay));
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
    toOptionalDateInputValue(formBlock?.recurrenceEndDate, initialTimeZone),
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

  const handleAllDayChange = (nextIsAllDay: boolean) => {
    setIsAllDay(nextIsAllDay);
    if (endDate < date) {
      setEndDate(date);
    }

    if (!nextIsAllDay && startTime === "00:00" && endTime === "00:00") {
      setStartTime("09:00");
      setEndTime("10:00");
    }
  };

  const handleCategoryChange = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    if (isCreating) {
      const nextCategory = categories.find(
        (category) => category.id === nextCategoryId,
      );
      setKind(nextCategory?.defaultBlockKind ?? "event");
    }
  };

  const handleTaskChange = (nextTaskId: string) => {
    setTaskId(nextTaskId);
    const nextTask = openTasks.find((task) => task.id === nextTaskId);
    if (nextTask) {
      handleCategoryChange(nextTask.categoryId);
      if (isCreating) {
        setTitle(nextTask.title);
      }
    }
  };

  const handleSave = async () => {
    const selectedTask = openTasks.find((task) => task.id === taskId);
    const nextTitle = isCreating && selectedTask ? selectedTask.title : title.trim();

    if (!nextTitle || !categoryId) {
      return;
    }

    const normalizedEndDate = endDate < date ? date : endDate;
    const nextStartResolution = resolveZonedDateTime(
      date,
      isAllDay ? "00:00" : startTime,
      timeZone,
      ambiguousTimeChoice,
    );
    const inclusiveEndDate = isAllDay
      ? toDateInputValue(getNextDayStart(normalizedEndDate))
      : normalizedEndDate;
    const nextEndResolution = resolveZonedDateTime(
      inclusiveEndDate,
      isAllDay ? "00:00" : endTime,
      timeZone,
      ambiguousTimeChoice,
    );
    if (
      nextStartResolution.status !== "valid" ||
      nextEndResolution.status !== "valid"
    ) {
      const ambiguous =
        nextStartResolution.status === "ambiguous" ||
        nextEndResolution.status === "ambiguous";
      setHasAmbiguousDateTime(ambiguous);
      setDateTimeError(
        ambiguous
          ? "This wall time occurs twice. Choose the first or second occurrence."
          : nextStartResolution.status === "invalid"
            ? nextStartResolution.message
            : nextEndResolution.status === "invalid"
              ? nextEndResolution.message
              : "Choose an exact wall time.",
      );
      return;
    }
    setHasAmbiguousDateTime(false);
    setDateTimeError(undefined);
    const nextStartsAt = nextStartResolution.date;
    const nextEndsAt = nextEndResolution.date;
    if (nextEndsAt <= nextStartsAt) {
      nextEndsAt.setTime(nextStartsAt.getTime() + minimumBlockMinutes * 60000);
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
    await onSave({
      id: block?.id,
      title: nextTitle,
      notes,
      categoryId: selectedTask?.categoryId ?? categoryId,
      taskId: taskId || undefined,
      startsAt: nextStartsAt.toISOString(),
      endsAt: nextEndsAt.toISOString(),
      outcome,
      kind,
      source,
      isAllDay,
      recurrenceFrequency,
      recurrenceInterval: isRepeating ? normalizedInterval : undefined,
      recurrenceWeekdays:
        recurrenceFrequency === "weekly" ? recurrenceWeekdays : undefined,
      recurrenceEndMode: isRepeating ? recurrenceEndMode : "never",
      recurrenceEndDate:
        !isRepeating || recurrenceEndMode !== "on" || !recurrenceEndDate
          ? undefined
          : resolveZonedDateTime(
              recurrenceEndDate,
              "23:59",
              timeZone,
              ambiguousTimeChoice,
            ).status === "valid"
            ? (
                resolveZonedDateTime(
                  recurrenceEndDate,
                  "23:59",
                  timeZone,
                  ambiguousTimeChoice,
                ) as { status: "valid"; date: Date }
              ).date.toISOString()
            : undefined,
      recurrenceCount:
        isRepeating && recurrenceEndMode === "after"
          ? normalizedCount
          : undefined,
      timeZone,
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
              onChange={(event) => handleCategoryChange(event.target.value)}
              value={categoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <div className="dialog-field">
            <span>Kind</span>
            <SegmentedControl
              ariaLabel="Time block kind"
              compact
              onChange={setKind}
              options={blockKindOptions}
              value={kind}
            />
            {blockKindHelperText[kind] ? (
              <small className="field-helper-text">
                {blockKindHelperText[kind]}
              </small>
            ) : null}
          </div>
          <div className="dialog-field">
            <span>Outcome</span>
            <SegmentedControl
              ariaLabel="Time block outcome"
              compact
              onChange={setOutcome}
              options={blockOutcomeOptions}
              value={outcome}
            />
          </div>
          <label>
            <span>Source</span>
            <input readOnly value={sourceLabels[source]} />
          </label>
          <label>
            <span>Timezone</span>
            <select
              onChange={(event) => {
                setTimeZone(event.target.value);
                setAmbiguousTimeChoice(undefined);
                setHasAmbiguousDateTime(false);
                setDateTimeError(undefined);
              }}
              value={timeZone}
            >
              {[...new Set([...timeZones, timeZone])].map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
          <div className="dialog-field">
            <span>All-day</span>
            <ToggleRow
              checked={isAllDay}
              label="Show in the all-day row"
              onChange={handleAllDayChange}
            />
          </div>
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
              disabled={isAllDay}
              onChange={(event) => setStartTime(event.target.value)}
              step={minimumBlockMinutes * 60}
              type="time"
              value={startTime}
            />
          </label>
          <label>
            <span>End</span>
            <input
              disabled={isAllDay}
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
          {hasAmbiguousDateTime ? (
            <div className="dialog-wide-field timezone-resolution-panel">
              <small className="field-helper-text">{dateTimeError}</small>
              <SegmentedControl
                ariaLabel="DST occurrence"
                compact
                onChange={setAmbiguousTimeChoice}
                options={[
                  { value: "earlier", label: "First occurrence" },
                  { value: "later", label: "Second occurrence" },
                ]}
                value={ambiguousTimeChoice ?? ""}
              />
            </div>
          ) : dateTimeError ? (
            <small className="dialog-wide-field field-helper-text">
              {dateTimeError}
            </small>
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
