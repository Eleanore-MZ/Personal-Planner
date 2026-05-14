import type { WeekRhythmDay } from "../../utils/stats";

type WeekRhythmStripProps = {
  days: WeekRhythmDay[];
  title?: string;
};

const rhythmTicks = ["00", "06", "12", "18", "24"];
const laneHeightPx = 7;
const lanePaddingPx = 2;

function WeekRhythmStrip({ days, title = "Weekly rhythm" }: WeekRhythmStripProps) {
  const hasSegments = days.some((day) => day.segments.length > 0);
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

  return (
    <section className="stats-card week-rhythm-card">
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
                {day.segments.map((segment) => (
                  <div
                    className="week-rhythm-segment"
                    key={`${segment.startMinute}-${segment.endMinute}-${segment.groupName}-${segment.lane}`}
                    title={segment.tooltip}
                    style={{
                      background: segment.color,
                      left: `${(segment.startMinute / 1440) * 100}%`,
                      top: `${lanePaddingPx + segment.lane * laneHeightPx}px`,
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
          No tracked time for this week.
        </div>
      )}
    </section>
  );
}

export default WeekRhythmStrip;
