import type { DailyGroupHoursSegment } from "../../utils/stats";

export type PlannedHoursDatum = {
  label: string;
  hours: number;
  segments?: DailyGroupHoursSegment[];
};

type DailyPlannedHoursChartProps = {
  compact?: boolean;
  data: PlannedHoursDatum[];
  emptyMessage?: string;
  highlightMax?: boolean;
  kicker?: string;
  showInsights?: boolean;
  title?: string;
};

function DailyPlannedHoursChart({
  compact = false,
  data,
  emptyMessage = "No block time for this period under the current filters.",
  highlightMax = false,
  kicker = "Daily plan",
  showInsights = true,
  title = "Planned hours this week",
}: DailyPlannedHoursChartProps) {
  const maxHours = Math.max(...data.map((item) => item.hours), 1);
  const hasData = data.some((item) => item.hours > 0);
  const activeDays = data.filter((day) => day.hours > 0);
  const legendItems = Array.from(
    data
      .flatMap((day) => day.segments ?? [])
      .reduce((items, segment) => {
        if (!items.has(segment.groupId)) {
          items.set(segment.groupId, segment);
        }
        return items;
      }, new Map<string, DailyGroupHoursSegment>())
      .values(),
  );
  const busiestDay = activeDays.reduce<PlannedHoursDatum | null>(
    (current, day) => (!current || day.hours > current.hours ? day : current),
    null,
  );
  const lightestDay = activeDays.reduce<PlannedHoursDatum | null>(
    (current, day) => (!current || day.hours < current.hours ? day : current),
    null,
  );
  const groupTotals = data
    .flatMap((day) => day.segments ?? [])
    .reduce((totals, segment) => {
      const current = totals.get(segment.groupId) ?? {
        color: segment.color,
        groupName: segment.groupName,
        hours: 0,
      };
      current.hours += segment.hours;
      totals.set(segment.groupId, current);
      return totals;
    }, new Map<string, { color: string; groupName: string; hours: number }>());
  const topGroup = Array.from(groupTotals.values()).sort(
    (first, second) => second.hours - first.hours,
  )[0];
  const strongestPair = data
    .flatMap((day) =>
      (day.segments ?? []).map((segment) => ({
        dayLabel: day.label,
        groupName: segment.groupName,
        hours: segment.hours,
      })),
    )
    .sort((first, second) => second.hours - first.hours)[0];
  const shouldShowInsights = showInsights && legendItems.length > 0;

  return (
    <section className="stats-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">{kicker}</div>
          <h2>{title}</h2>
        </div>
      </div>

      {hasData ? (
        <>
          <div className={`vertical-chart${compact ? " compact" : ""}`}>
            {data.map((day, index) => (
              <div
                className={`vertical-chart-column${
                  highlightMax && day.hours === maxHours ? " busiest" : ""
                }`}
                key={`${day.label}-${index}`}
              >
                <div className="vertical-bar-wrap">
                  {day.segments ? (
                    <div
                      className="vertical-stacked-bar"
                      style={{ height: `${(day.hours / maxHours) * 100}%` }}
                    >
                      {day.segments.map((segment) => {
                        const percent = day.hours > 0
                          ? (segment.hours / day.hours) * 100
                          : 0;
                        return (
                          <div
                            className="vertical-stack-segment"
                            key={segment.groupId}
                            style={{
                              background: segment.color,
                              height: `${percent}%`,
                            }}
                            title={`${day.label}\n${segment.groupName}: ${segment.hours.toFixed(
                              1,
                            )}h\nTotal: ${day.hours.toFixed(
                              1,
                            )}h\n${Math.round(percent)}% of day`}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      className="vertical-bar"
                      style={{ height: `${(day.hours / maxHours) * 100}%` }}
                    />
                  )}
                </div>
                <strong>{day.hours.toFixed(1)}h</strong>
                <span>{day.label}</span>
              </div>
            ))}
          </div>
          {legendItems.length > 0 ? (
            <div className="stacked-chart-legend">
              {legendItems.map((segment) => (
                <span key={segment.groupId}>
                  <i style={{ background: segment.color }} />
                  {segment.groupName}
                </span>
              ))}
            </div>
          ) : null}
          {shouldShowInsights ? (
            <div className="weekday-insights">
              <div className="weekday-insight">
                <span>Busiest day</span>
                <strong>
                  {busiestDay
                    ? `${busiestDay.label} · ${busiestDay.hours.toFixed(1)}h`
                    : "None"}
                </strong>
              </div>
              <div className="weekday-insight">
                <span>Lightest day</span>
                <strong>
                  {lightestDay
                    ? `${lightestDay.label} · ${lightestDay.hours.toFixed(1)}h`
                    : "None"}
                </strong>
              </div>
              <div className="weekday-insight">
                <span>Active days</span>
                <strong>{activeDays.length} / {data.length}</strong>
              </div>
              <div className="weekday-insight">
                <span>Top group</span>
                <strong>
                  {topGroup
                    ? `${topGroup.groupName} · ${topGroup.hours.toFixed(1)}h`
                    : "None"}
                </strong>
              </div>
              <div className="weekday-insight wide">
                <span>Strongest pair</span>
                <strong>
                  {strongestPair
                    ? `${strongestPair.groupName} · ${strongestPair.dayLabel} · ${strongestPair.hours.toFixed(1)}h`
                    : "None"}
                </strong>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="empty-state">{emptyMessage}</div>
      )}
    </section>
  );
}

export default DailyPlannedHoursChart;
