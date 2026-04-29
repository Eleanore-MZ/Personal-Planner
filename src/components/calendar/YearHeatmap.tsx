import { useMemo, useState } from "react";
import type { Category, Task, TimeBlock } from "../../types/domain";
import { getTimeBlockMinutes } from "../../utils/stats";
import { getBlocksForDay, isSameCalendarDay, startOfDay } from "../../utils/calendar";
import { formatDate } from "../../utils/date";
import { isTaskComplete } from "../../utils/tasks";

type YearHeatmapMetric =
  | "planned-hours"
  | "study-hours"
  | "completed-tasks"
  | "overdue-tasks";

type YearHeatmapProps = {
  categories: Category[];
  date: Date;
  selectedDate?: Date;
  tasks: Task[];
  timeBlocks: TimeBlock[];
  onSelectDate: (date: Date) => void;
};

const metrics: Array<{ id: YearHeatmapMetric; label: string }> = [
  { id: "planned-hours", label: "Total planned hours" },
  { id: "study-hours", label: "Study hours" },
  { id: "completed-tasks", label: "Completed tasks" },
  { id: "overdue-tasks", label: "Overdue tasks" },
];

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

function getDaysInYear(year: number) {
  const days: Date[] = [];
  const date = new Date(year, 0, 1);

  while (date.getFullYear() === year) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }

  return days;
}

function getMetricValue(
  metric: YearHeatmapMetric,
  date: Date,
  categories: Category[],
  tasks: Task[],
  timeBlocks: TimeBlock[],
) {
  const dayBlocks = getBlocksForDay(timeBlocks, date);

  if (metric === "planned-hours") {
    return dayBlocks.reduce(
      (total, block) => total + getTimeBlockMinutes(block) / 60,
      0,
    );
  }

  if (metric === "study-hours") {
    const studyCategoryIds = categories
      .filter((category) =>
        /learning|study|school|class/i.test(category.name),
      )
      .map((category) => category.id);

    return dayBlocks
      .filter((block) => studyCategoryIds.includes(block.categoryId))
      .reduce((total, block) => total + getTimeBlockMinutes(block) / 60, 0);
  }

  const dayTasks = tasks.filter(
    (task) => task.dueDate && isSameCalendarDay(new Date(task.dueDate), date),
  );

  if (metric === "completed-tasks") {
    return dayTasks.filter(isTaskComplete).length;
  }

  const today = startOfDay(new Date());
  return dayTasks.filter(
    (task) => !isTaskComplete(task) && startOfDay(new Date(task.dueDate!)) < today,
  ).length;
}

function getIntensity(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil((value / maxValue) * 4));
}

function YearHeatmap({
  categories,
  date,
  selectedDate,
  tasks,
  timeBlocks,
  onSelectDate,
}: YearHeatmapProps) {
  const [metric, setMetric] = useState<YearHeatmapMetric>("planned-hours");
  const year = date.getFullYear();
  const days = useMemo(() => getDaysInYear(year), [year]);
  const values = useMemo(
    () =>
      days.map((day) => ({
        date: day,
        value: getMetricValue(metric, day, categories, tasks, timeBlocks),
      })),
    [categories, days, metric, tasks, timeBlocks],
  );
  const maxValue = Math.max(...values.map((item) => item.value), 0);
  const leadingEmptyDays = days[0]?.getDay() ?? 0;
  const cells = [
    ...Array.from({ length: leadingEmptyDays }, () => undefined),
    ...values,
  ];
  const weekCount = Math.ceil(cells.length / 7);
  const monthLabels = days
    .filter((day) => day.getDate() === 1)
    .map((day) => ({
      label: monthFormatter.format(day),
      column: Math.floor((leadingEmptyDays + days.indexOf(day)) / 7) + 1,
    }));

  return (
    <section className="year-heatmap-panel">
      <div className="year-heatmap-toolbar">
        <div>
          <div className="panel-kicker">Year activity</div>
          <h2>{year} heatmap</h2>
        </div>
        <div className="metric-switcher" aria-label="Year heatmap metric">
          {metrics.map((item) => (
            <button
              className={metric === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setMetric(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

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
        {cells.map((cell, index) =>
          cell ? (
            <button
              aria-label={`${formatDate(cell.date)}: ${cell.value.toFixed(1)}`}
              className={`heatmap-day intensity-${getIntensity(
                cell.value,
                maxValue,
              )}${
                selectedDate && isSameCalendarDay(selectedDate, cell.date)
                  ? " selected"
                  : ""
              }`}
              key={cell.date.toISOString()}
              onClick={() => onSelectDate(cell.date)}
              title={`${formatDate(cell.date)}: ${cell.value.toFixed(1)}`}
              type="button"
            />
          ) : (
            <span className="heatmap-empty" key={`empty-${index}`} />
          ),
        )}
      </div>

      <div className="heatmap-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span className={`heatmap-day intensity-${level}`} key={level} />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}

export default YearHeatmap;
