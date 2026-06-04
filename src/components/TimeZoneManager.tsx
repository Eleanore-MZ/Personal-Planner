import { useMemo, useState, type DragEvent } from "react";
import {
  formatTimeZoneNow,
  getTimeZoneLabel,
  isValidTimeZone,
  maxCalendarTimeZones,
  normalizeCalendarTimeZones,
} from "../utils/timezone";

type TimeZoneManagerProps = {
  compact?: boolean;
  primaryTimeZone: string;
  timeZones: string[];
  onChange: (timeZones: string[], primaryTimeZone: string) => void;
};

const getSupportedTimeZones = () => {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  return intl.supportedValuesOf?.("timeZone") ?? [];
};

function TimeZoneManager({
  compact = false,
  primaryTimeZone,
  timeZones,
  onChange,
}: TimeZoneManagerProps) {
  const [draftTimeZone, setDraftTimeZone] = useState("");
  const [draggedTimeZone, setDraggedTimeZone] = useState<string>();
  const supportedTimeZones = useMemo(getSupportedTimeZones, []);
  const normalizedDraft = draftTimeZone.trim();
  const canAdd =
    normalizedDraft.length > 0 &&
    isValidTimeZone(normalizedDraft) &&
    !timeZones.includes(normalizedDraft) &&
    timeZones.length < maxCalendarTimeZones;

  const commit = (nextTimeZones: string[], nextPrimary = primaryTimeZone) => {
    const normalized = normalizeCalendarTimeZones(nextTimeZones, nextPrimary);
    onChange(normalized.calendarTimeZones, normalized.primaryCalendarTimeZone);
  };

  const removeTimeZone = (timeZone: string) => {
    if (timeZones.length <= 1) {
      return;
    }
    const nextTimeZones = timeZones.filter((currentZone) => currentZone !== timeZone);
    commit(
      nextTimeZones,
      timeZone === primaryTimeZone ? nextTimeZones[0] : primaryTimeZone,
    );
  };

  const reorderTimeZone = (targetTimeZone: string) => {
    if (!draggedTimeZone || draggedTimeZone === targetTimeZone) {
      return;
    }
    const nextTimeZones = timeZones.filter((timeZone) => timeZone !== draggedTimeZone);
    nextTimeZones.splice(nextTimeZones.indexOf(targetTimeZone), 0, draggedTimeZone);
    commit(nextTimeZones);
    setDraggedTimeZone(undefined);
  };

  return (
    <div className={`timezone-manager${compact ? " compact" : ""}`}>
      <div className="timezone-manager-list">
        {timeZones.map((timeZone) => (
          <div
            className={`timezone-manager-row${
              timeZone === primaryTimeZone ? " primary" : ""
            }`}
            draggable
            key={timeZone}
            onDragEnd={() => setDraggedTimeZone(undefined)}
            onDragOver={(event) => event.preventDefault()}
            onDragStart={(event: DragEvent<HTMLDivElement>) => {
              event.dataTransfer.effectAllowed = "move";
              setDraggedTimeZone(timeZone);
            }}
            onDrop={() => reorderTimeZone(timeZone)}
          >
            <button
              className="timezone-primary-button"
              onClick={() => commit(timeZones, timeZone)}
              type="button"
            >
              <strong>{getTimeZoneLabel(timeZone)}</strong>
              <small>{timeZone}</small>
            </button>
            <span>{formatTimeZoneNow(timeZone)}</span>
            <button
              className="timezone-remove-button"
              disabled={timeZones.length <= 1}
              onClick={() => removeTimeZone(timeZone)}
              type="button"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="timezone-add-row">
        <input
          list="planner-timezone-options"
          onChange={(event) => setDraftTimeZone(event.target.value)}
          placeholder="Add IANA timezone"
          value={draftTimeZone}
        />
        <datalist id="planner-timezone-options">
          {supportedTimeZones.map((timeZone) => (
            <option key={timeZone} value={timeZone} />
          ))}
        </datalist>
        <button
          className="toolbar-button"
          disabled={!canAdd}
          onClick={() => {
            commit([...timeZones, normalizedDraft]);
            setDraftTimeZone("");
          }}
          type="button"
        >
          Add
        </button>
      </div>
      <small className="field-helper-text">
        {timeZones.length}/{maxCalendarTimeZones} zones. Drag rows to reorder.
      </small>
    </div>
  );
}

export default TimeZoneManager;
