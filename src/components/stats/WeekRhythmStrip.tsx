import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import type { WeekRhythmDay, WeekRhythmSegment } from "../../utils/stats";

type WeekRhythmStripProps = {
  days: WeekRhythmDay[];
  title?: string;
};

const rhythmTicks = ["00", "03", "06", "09", "12", "15", "18", "21", "24"];
const laneHeightPx = 7;
const lanePaddingPx = 2;

type InspectableSegment = {
  dayLabel: string;
  key: string;
  segment: WeekRhythmSegment;
};

const getSegmentKey = (
  day: WeekRhythmDay,
  segment: WeekRhythmSegment,
  index: number,
) =>
  `${day.date}-${index}-${segment.startMinute}-${segment.endMinute}-${segment.lane}`;

const formatDuration = (durationMinutes: number) => {
  const roundedMinutes = Math.max(Math.round(durationMinutes), 0);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
};

function WeekRhythmStrip({ days, title = "Weekly rhythm" }: WeekRhythmStripProps) {
  const [previewSegmentKey, setPreviewSegmentKey] = useState<string | null>(null);
  const [selectedSegmentKey, setSelectedSegmentKey] = useState<string | null>(null);
  const hasSegments = days.some((day) => day.segments.length > 0);
  const inspectableSegments = useMemo<InspectableSegment[]>(
    () =>
      days.flatMap((day) =>
        day.segments.map((segment, index) => ({
          dayLabel: day.label,
          key: getSegmentKey(day, segment, index),
          segment,
        })),
      ),
    [days],
  );
  const previewSegment =
    inspectableSegments.find((item) => item.key === previewSegmentKey) ?? null;
  const selectedSegment =
    inspectableSegments.find((item) => item.key === selectedSegmentKey) ?? null;
  const activeSegment = previewSegment ?? selectedSegment;
  const activeSegmentMode = previewSegment ? "Preview segment" : "Selected segment";
  const legendItems = Array.from(
    days
      .flatMap((day) => day.segments)
      .reduce((items, segment) => {
        const key = `${segment.groupName}-${segment.color}`;
        if (!items.has(key)) {
          items.set(key, {
            color: segment.color,
            groupName: segment.groupName,
          });
        }
        return items;
      }, new Map<string, { color: string; groupName: string }>())
      .values(),
  );

  useEffect(() => {
    if (
      selectedSegmentKey &&
      !inspectableSegments.some((segment) => segment.key === selectedSegmentKey)
    ) {
      setSelectedSegmentKey(null);
    }
  }, [inspectableSegments, selectedSegmentKey]);

  const handleSegmentKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    segmentKey: string,
  ) => {
    if (event.key === "Escape") {
      setSelectedSegmentKey(null);
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    setSelectedSegmentKey(segmentKey);
  };

  return (
    <section
      className="stats-card week-rhythm-card"
      onClick={() => setSelectedSegmentKey(null)}
    >
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Week rhythm</div>
          <h2>{title}</h2>
        </div>
        {legendItems.length > 0 ? (
          <div className="week-rhythm-legend" aria-label="Week rhythm legend">
            {legendItems.map((item) => (
              <span key={`${item.groupName}-${item.color}`}>
                <i style={{ background: item.color }} />
                {item.groupName}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {hasSegments ? (
        <div className="week-rhythm">
          <div className="week-rhythm-axis" aria-hidden="true">
            <span />
            <div>
              {rhythmTicks.map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
          </div>
          {days.map((day) => (
            <div className="week-rhythm-row" key={day.date}>
              <span>{day.label}</span>
              <div
                className="week-rhythm-track"
                style={{
                  height: `${day.laneCount * laneHeightPx + lanePaddingPx * 2}px`,
                }}
              >
                {day.segments.map((segment, index) => {
                  const segmentKey = getSegmentKey(day, segment, index);
                  const isSelected = selectedSegmentKey === segmentKey;
                  const isPreview = previewSegmentKey === segmentKey;
                  const segmentLabel = `${day.label} ${segment.timeRange}, ${
                    segment.blockTitle
                  }, ${segment.categoryName}, ${segment.groupName}, ${formatDuration(
                    segment.durationMinutes,
                  )}`;

                  return (
                    <button
                      aria-label={segmentLabel}
                      aria-pressed={isSelected}
                      className={`week-rhythm-segment${
                        isSelected ? " selected" : ""
                      }${isPreview ? " preview" : ""}`}
                      key={segmentKey}
                      onBlur={() => setPreviewSegmentKey(null)}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedSegmentKey(segmentKey);
                      }}
                      onFocus={() => setPreviewSegmentKey(segmentKey)}
                      onKeyDown={(event) => handleSegmentKeyDown(event, segmentKey)}
                      onMouseEnter={() => setPreviewSegmentKey(segmentKey)}
                      onMouseLeave={() => setPreviewSegmentKey(null)}
                      style={{
                        "--week-rhythm-segment-color": segment.color,
                        background: segment.color,
                        left: `${(segment.startMinute / 1440) * 100}%`,
                        top: `${lanePaddingPx + segment.lane * laneHeightPx}px`,
                        width: `${((segment.endMinute - segment.startMinute) / 1440) * 100}%`,
                      } as CSSProperties}
                      title={segment.tooltip}
                      type="button"
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <div className="week-rhythm-selection-readout">
            {activeSegment ? (
              <>
                <div>
                  <span>{activeSegmentMode}</span>
                  <strong>
                    {activeSegment.dayLabel} {activeSegment.segment.timeRange}
                  </strong>
                </div>
                <div>
                  <span>Block</span>
                  <strong>{activeSegment.segment.blockTitle}</strong>
                </div>
                <div>
                  <span>Category</span>
                  <strong>{activeSegment.segment.categoryName}</strong>
                </div>
                <div>
                  <span>Stats Group</span>
                  <strong>{activeSegment.segment.groupName}</strong>
                </div>
                <div>
                  <span>Duration</span>
                  <strong>{formatDuration(activeSegment.segment.durationMinutes)}</strong>
                </div>
              </>
            ) : (
              <span className="week-rhythm-selection-empty">
                Hover or select a rhythm segment.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          No tracked time for this week.
        </div>
      )}
    </section>
  );
}

export default WeekRhythmStrip;
