import { useMemo, useState } from "react";
import type { DailyGroupHoursSegment } from "../../utils/stats";

export type PlannedHoursDatum = {
  label: string;
  hours: number;
  segments?: DailyGroupHoursSegment[];
};

type DailyPlannedHoursChartProps = {
  className?: string;
  compact?: boolean;
  data: PlannedHoursDatum[];
  emptyMessage?: string;
  highlightMax?: boolean;
  kicker?: string;
  showInsights?: boolean;
  title?: string;
};

function DailyPlannedHoursChart({
  className,
  compact = false,
  data,
  emptyMessage = "No tracked time for this period.",
  highlightMax = false,
  kicker = "Daily plan",
  showInsights = true,
  title = "Tracked time this week",
}: DailyPlannedHoursChartProps) {
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(
    () => new Set(),
  );
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
  const chartData = useMemo(
    () =>
      data.map((day) => {
        if (!day.segments) {
          return day;
        }

        const segments = day.segments.filter(
          (segment) => !hiddenGroupIds.has(segment.groupId),
        );

        return {
          ...day,
          hours: segments.reduce((total, segment) => total + segment.hours, 0),
          segments,
        };
      }),
    [data, hiddenGroupIds],
  );
  const maxHours = Math.max(...chartData.map((item) => item.hours), 1);
  const hasData = chartData.some((item) => item.hours > 0);
  const hasSourceData = data.some((item) => item.hours > 0);
  const activeDays = chartData.filter((day) => day.hours > 0);
  const busiestDay = activeDays.reduce<PlannedHoursDatum | null>(
    (current, day) => (!current || day.hours > current.hours ? day : current),
    null,
  );
  const lightestDay = activeDays.reduce<PlannedHoursDatum | null>(
    (current, day) => (!current || day.hours < current.hours ? day : current),
    null,
  );
  const groupTotals = chartData
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
  const strongestPair = chartData
    .flatMap((day) =>
      (day.segments ?? []).map((segment) => ({
        dayLabel: day.label,
        groupName: segment.groupName,
        hours: segment.hours,
      })),
    )
    .sort((first, second) => second.hours - first.hours)[0];
  const shouldShowInsights = showInsights && legendItems.length > 0 && hasData;
  const toggleGroup = (groupId: string) => {
    setHiddenGroupIds((currentGroupIds) => {
      const nextGroupIds = new Set(currentGroupIds);
      if (nextGroupIds.has(groupId)) {
        nextGroupIds.delete(groupId);
      } else {
        nextGroupIds.add(groupId);
      }
      return nextGroupIds;
    });
  };

  return (
    <section className={`stats-card${className ? ` ${className}` : ""}`}>
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">{kicker}</div>
          <h2>{title}</h2>
        </div>
      </div>

      {hasSourceData ? (
        <>
          <div className={`vertical-chart${compact ? " compact" : ""}`}>
            {chartData.map((day, index) => (
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
              {legendItems.map((segment) => {
                const isIncluded = !hiddenGroupIds.has(segment.groupId);
                return (
                  <button
                    aria-pressed={isIncluded}
                    className={!isIncluded ? "muted" : undefined}
                    key={segment.groupId}
                    onClick={() => toggleGroup(segment.groupId)}
                    title={`${isIncluded ? "Hide" : "Show"} ${segment.groupName}`}
                    type="button"
                  >
                    <i style={{ background: segment.color }} />
                    {segment.groupName}
                  </button>
                );
              })}
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
