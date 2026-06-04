import { useState } from "react";
import type { Task } from "../../types/domain";
import type { CreateTimeBlockInput } from "../../types/plannerApi";
import { useCalendarTimeZone } from "../useCalendarTimeZone";
import {
  resolveZonedDateTime,
  toZonedCalendarDate,
  type AmbiguousTimeChoice,
} from "../../utils/timezone";
import { SegmentedControl } from "../ui/ChoiceControls";

type PlanSessionDialogProps = {
  task: Task;
  onClose: () => void;
  onPlanSession: (timeBlock: CreateTimeBlockInput) => void;
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function PlanSessionDialog({
  task,
  onClose,
  onPlanSession,
}: PlanSessionDialogProps) {
  const timeZone = useCalendarTimeZone();
  const [date, setDate] = useState(() =>
    toDateInputValue(toZonedCalendarDate(new Date(), timeZone)),
  );
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [ambiguousTimeChoice, setAmbiguousTimeChoice] =
    useState<AmbiguousTimeChoice>();
  const [dateTimeError, setDateTimeError] = useState<string>();
  const [hasAmbiguousDateTime, setHasAmbiguousDateTime] = useState(false);

  const handleSubmit = () => {
    const startResolution = resolveZonedDateTime(
      date,
      startTime,
      timeZone,
      ambiguousTimeChoice,
    );
    if (startResolution.status !== "valid") {
      const ambiguous = startResolution.status === "ambiguous";
      setHasAmbiguousDateTime(ambiguous);
      setDateTimeError(
        ambiguous
          ? "This wall time occurs twice. Choose the first or second occurrence."
          : startResolution.message,
      );
      return;
    }
    setDateTimeError(undefined);
    setHasAmbiguousDateTime(false);
    const startsAt = startResolution.date;
    const durationMinutes = Math.max(15, Number(duration));
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);

    onPlanSession({
      id: `block-${task.id}-${startsAt.getTime()}`,
      title: task.title,
      notes: `Planned session for ${task.title}.`,
      categoryId: task.categoryId,
      taskId: task.id,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      outcome: "active",
      kind: "task-session",
      source: "manual",
      timeZone,
    });
    onClose();
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-label="Plan Session" className="fake-dialog">
        <div className="fake-dialog-header">
          <div>
            <div className="panel-kicker">Plan session</div>
            <h2>{task.title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="dialog-form-grid">
          <label>
            <span>Date</span>
            <input
              onChange={(event) => {
                setDate(event.target.value);
                setAmbiguousTimeChoice(undefined);
                setDateTimeError(undefined);
                setHasAmbiguousDateTime(false);
              }}
              type="date"
              value={date}
            />
          </label>
          <label>
            <span>Start time</span>
            <input
              onChange={(event) => {
                setStartTime(event.target.value);
                setAmbiguousTimeChoice(undefined);
                setDateTimeError(undefined);
                setHasAmbiguousDateTime(false);
              }}
              type="time"
              value={startTime}
            />
          </label>
          <label>
            <span>Duration</span>
            <select
              onChange={(event) => setDuration(event.target.value)}
              value={duration}
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1 hour 30 minutes</option>
              <option value="120">2 hours</option>
            </select>
          </label>
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
        </div>

        <div className="fake-dialog-actions">
          <button className="toolbar-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="toolbar-button primary-action"
            onClick={handleSubmit}
            type="button"
          >
            Add Session
          </button>
        </div>
      </section>
    </div>
  );
}

export default PlanSessionDialog;
