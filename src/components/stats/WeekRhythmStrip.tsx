import type { WeekRhythmDay } from "../../utils/stats";

type WeekRhythmStripProps = {
  days: WeekRhythmDay[];
  metricLabel: string;
};

const rhythmTicks = ["00", "06", "12", "18", "24"];

function getSegmentOpacity(intensity: number) {
  return Math.min(0.36 + Math.max(intensity - 1, 0) * 0.18, 0.9);
}

function WeekRhythmStrip({ days, metricLabel }: WeekRhythmStripProps) {
  const hasSegments = days.some((day) => day.segments.length > 0);
  const capitalizedMetric =
    metricLabel.charAt(0).toUpperCase() + metricLabel.slice(1);

  return (
    <section className="stats-card week-rhythm-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Week rhythm</div>
          <h2>{capitalizedMetric} week rhythm</h2>
        </div>
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
              <div className="week-rhythm-track">
                {day.segments.map((segment) => (
                  <div
                    className="week-rhythm-segment"
                    key={`${segment.startMinute}-${segment.endMinute}-${segment.intensity}`}
                    style={{
                      left: `${(segment.startMinute / 1440) * 100}%`,
                      opacity: getSegmentOpacity(segment.intensity),
                      width: `${((segment.endMinute - segment.startMinute) / 1440) * 100}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          No {metricLabel} rhythm data for this week under the current filters.
        </div>
      )}
    </section>
  );
}

export default WeekRhythmStrip;
