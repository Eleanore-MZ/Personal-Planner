import type { TimeGroupDatum } from "../../utils/stats";

type TimeGroupsSummaryProps = {
  emptyMessage?: string;
  groups: TimeGroupDatum[];
  metricLabel: string;
};

const ringRadius = 44;
const ringCircumference = 2 * Math.PI * ringRadius;

function TimeGroupsSummary({
  emptyMessage = "No tracked time for this period.",
  groups,
  metricLabel,
}: TimeGroupsSummaryProps) {
  const visibleGroups = groups.filter((group) => group.hours > 0);
  const totalHours = visibleGroups.reduce((total, group) => total + group.hours, 0);
  const hasTrackedTime = totalHours > 0;
  let runningPercent = 0;

  return (
    <section className="stats-card time-groups-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Time groups</div>
          <h2>Time distribution by group</h2>
        </div>
      </div>

      {hasTrackedTime ? (
        <div className="time-groups-ring-layout">
          <div className="time-groups-ring-wrap" aria-hidden="true">
            <svg className="time-groups-ring" viewBox="0 0 120 120">
              <circle className="time-groups-ring-track" cx="60" cy="60" r={ringRadius} />
              {visibleGroups.map((group) => {
                const percent = (group.hours / totalHours) * 100;
                const dash = (percent / 100) * ringCircumference;
                const gap = ringCircumference - dash;
                const offset = -((runningPercent / 100) * ringCircumference);
                runningPercent += percent;

                return (
                  <circle
                    className="time-groups-ring-slice"
                    cx="60"
                    cy="60"
                    key={group.id}
                    r={ringRadius}
                    style={{
                      stroke: group.color,
                      strokeDasharray: `${dash} ${gap}`,
                      strokeDashoffset: offset,
                    }}
                  />
                );
              })}
            </svg>
            <div className="time-groups-ring-center">
              <strong>{totalHours.toFixed(1)}h</strong>
              <span>{metricLabel}</span>
            </div>
          </div>

          <div className="time-groups-legend">
            {visibleGroups.map((group) => {
              const percent = totalHours > 0 ? (group.hours / totalHours) * 100 : 0;

              return (
                <div className="time-group-legend-row" key={group.id}>
                  <div className="time-group-meta">
                    <span
                      className="chart-swatch"
                      style={{ background: group.color }}
                    />
                    <div>
                      <strong>{group.name}</strong>
                      {!group.countsTowardProductiveTime ? (
                        <small>not productive</small>
                      ) : null}
                    </div>
                  </div>
                  <div className="time-group-values">
                    <strong>{group.hours.toFixed(1)}h</strong>
                    <span>{Math.round(percent)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state">{emptyMessage}</div>
      )}
    </section>
  );
}

export default TimeGroupsSummary;
