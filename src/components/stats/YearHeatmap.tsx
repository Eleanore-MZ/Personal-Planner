import type { ReactNode } from "react";
import type { StatsHeatmapMetric } from "../../types/app";
import { statsHeatmapMetrics } from "../../data/stats";
import {
  getHeatmapIntensity,
  getHeatmapValue,
  type YearHeatmapDay,
} from "../../utils/stats";
import { formatDate } from "../../utils/date";
import { isSameCalendarDay } from "../../utils/calendar";

type YearHeatmapProps = {
  children?: ReactNode;
  data: YearHeatmapDay[];
  metric: StatsHeatmapMetric;
  onPreviewDate?: (date?: Date) => void;
  selectedDate?: Date;
  year: number;
  onSelectDate: (date: Date) => void;
};

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

function formatHeatmapValue(metric: StatsHeatmapMetric, value: number) {
  if (metric === "time_blocks_count") {
    return Math.round(value).toString();
  }

  return `${value.toFixed(1)}h`;
}

function YearHeatmap({
  children,
  data,
  metric,
  onPreviewDate,
  selectedDate,
  year,
  onSelectDate,
}: YearHeatmapProps) {
  const maxValue = Math.max(
    ...data.map((day) => getHeatmapValue(day, metric)),
    0,
  );
  const metricLabel =
    statsHeatmapMetrics.find((metricOption) => metricOption.id === metric)?.label ??
    "Activity";
  const firstDay = data[0] ? new Date(data[0].date) : new Date(year, 0, 1);
  const today = new Date();
  const leadingEmptyDays = firstDay.getDay();
  const cells = [
    ...Array.from({ length: leadingEmptyDays }, () => undefined),
    ...data,
  ];
  const weekCount = Math.ceil(cells.length / 7);
  const monthLabels = data
    .map((day, index) => ({ date: new Date(day.date), index }))
    .filter((item) => item.date.getDate() === 1)
    .map((item) => ({
      label: monthFormatter.format(item.date),
      column: Math.floor((leadingEmptyDays + item.index) / 7) + 1,
    }));

  return (
    <section className="year-heatmap-panel stats-heatmap-card">
      <div className="year-heatmap-toolbar">
        <div>
          <div className="panel-kicker">Year activity</div>
          <h2>{year} {metricLabel.toLowerCase()} heatmap</h2>
        </div>
      </div>

      <div className="year-heatmap-scroll">
        <div
          className="year-month-labels"
          style={{ gridTemplateColumns: `repeat(${weekCount}, 13px)` }}
        >
          {monthLabels.map((month) => (
            <span
              key={`${month.label}-${month.column}`}
              style={{ gridColumn: `${month.column} / span 4` }}
            >
              {month.label}
            </span>
          ))}
        </div>

        <div
          className="year-heatmap-grid"
          style={{ gridTemplateRows: "repeat(7, 13px)" }}
        >
          {cells.map((cell, index) => {
            if (!cell) {
              return <span className="heatmap-empty" key={`empty-${index}`} />;
            }

            const value = getHeatmapValue(cell, metric);
            const formattedValue = formatHeatmapValue(metric, value);
            const date = new Date(cell.date);
            const isSelected =
              selectedDate && isSameCalendarDay(selectedDate, date);
            const isCurrentDay = isSameCalendarDay(today, date);
            return (
              <button
                aria-label={`${formatDate(date)}: ${metricLabel} ${formattedValue}`}
                className={`heatmap-day intensity-${getHeatmapIntensity(
                  value,
                  maxValue,
                )}${isSelected ? " selected" : ""}${
                  isCurrentDay ? " current-day" : ""
                }`}
                key={cell.date}
                onBlur={() => onPreviewDate?.()}
                onClick={() => {
                  onSelectDate(date);
                  onPreviewDate?.();
                }}
                onFocus={() => onPreviewDate?.(date)}
                onMouseEnter={() => onPreviewDate?.(date)}
                onMouseLeave={() => onPreviewDate?.()}
                title={`${formatDate(date)}: ${metricLabel} ${formattedValue}`}
                type="button"
              />
            );
          })}
        </div>
      </div>

      <div className="heatmap-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span className={`heatmap-day intensity-${level}`} key={level} />
        ))}
        <span>More</span>
      </div>
      {children ? (
        <div className="year-heatmap-attached-panel">{children}</div>
      ) : null}
    </section>
  );
}

export default YearHeatmap;
