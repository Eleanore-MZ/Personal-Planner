import { useMemo } from "react";
import type { StatsFilters, WeekStartDay } from "../../types/app";
import type { Category, Task, TimeBlock } from "../../types/domain";
import CategoryHoursChart from "./CategoryHoursChart";
import DailyPlannedHoursChart from "./DailyPlannedHoursChart";
import SelectedDayStats from "./SelectedDayStats";
import StatsKpiGrid from "./StatsKpiGrid";
import TaskCompletionChart from "./TaskCompletionChart";
import YearHeatmap from "./YearHeatmap";
import YearTotalsPanel from "./YearTotalsPanel";
import {
  buildYearHeatmapData,
  calculateDailyPlannedHours,
  calculateDimensionHours,
  calculateMonthlyPlannedHours,
  calculateStatsSummary,
  calculateTaskStatusStats,
  calculateTotalPlannedHours,
  filterStatsTasks,
  filterStatsTimeBlocks,
  getTimeModeLabel,
  getOverdueTasks,
  getSelectedHeatmapDay,
  getStatsRange,
  getTasksDueInRange,
  getTimeBlocksInRange,
  type YearTotals,
} from "../../utils/stats";

type StatsViewProps = {
  categories: Category[];
  filters: StatsFilters;
  selectedStatsDate: Date;
  tasks: Task[];
  timeBlocks: TimeBlock[];
  weekStartDay: WeekStartDay;
  onSelectStatsDate: (date: Date) => void;
};

const modeLabel = {
  week: "Week",
  month: "Month",
  year: "Year",
};

function getPlannedHoursTitle(
  range: StatsFilters["range"],
  timeMode: StatsFilters["timeMode"],
) {
  const prefix = getTimeModeLabel(timeMode);

  if (range === "year") {
    return `${prefix} hours by month`;
  }

  if (range === "month") {
    return `${prefix} hours by day`;
  }

  return `${prefix} hours by day`;
}

function getCategoryBucketHours(
  timeBlocks: TimeBlock[],
  categories: Category[],
  matcher: (name: string) => boolean,
) {
  const matchingCategoryIds = new Set(
    categories
      .filter((category) => matcher(category.name.toLowerCase()))
      .map((category) => category.id),
  );
  return calculateTotalPlannedHours(
    timeBlocks.filter((block) => matchingCategoryIds.has(block.categoryId)),
  );
}

function getYearTotals(
  tasks: Task[],
  timeBlocks: TimeBlock[],
  categories: Category[],
) {
  return {
    createdTasks: tasks.length,
    completedTasks: tasks.filter((task) => task.status === "done").length,
    overdueTasks: getOverdueTasks(tasks).length,
    timeBlocksCount: timeBlocks.length,
    totalPlannedHours: calculateTotalPlannedHours(timeBlocks),
    studyHours: getCategoryBucketHours(timeBlocks, categories, (name) =>
      /study|learning|read|course/.test(name),
    ),
    classHours: getCategoryBucketHours(timeBlocks, categories, (name) =>
      /class|lecture|seminar|lab/.test(name),
    ),
    restHours: getCategoryBucketHours(timeBlocks, categories, (name) =>
      /rest|health|personal|recovery/.test(name),
    ),
  } satisfies YearTotals;
}

function StatsView({
  categories,
  filters,
  selectedStatsDate,
  tasks,
  timeBlocks,
  weekStartDay,
  onSelectStatsDate,
}: StatsViewProps) {
  const periodDate = useMemo(
    () => new Date(filters.selectedDateIso),
    [filters.selectedDateIso],
  );
  const range = useMemo(
    () => getStatsRange(filters.range, periodDate, weekStartDay),
    [filters.range, periodDate, weekStartDay],
  );
  const filteredTasks = useMemo(
    () => {
      if (filters.refreshKey < 0) {
        return [];
      }

      return filterStatsTasks(
        tasks,
        filters.categoryId,
        filters.includeCompletedTasks,
        filters.includeUncategorized,
        categories,
        filters.includeStatsExcludedCategories,
      );
    },
    [
      categories,
      filters.categoryId,
      filters.includeCompletedTasks,
      filters.includeStatsExcludedCategories,
      filters.includeUncategorized,
      filters.refreshKey,
      tasks,
    ],
  );
  const filteredBlocks = useMemo(() => {
    if (filters.refreshKey < 0) {
      return [];
    }

      return filterStatsTimeBlocks(
        timeBlocks,
        filters.categoryId,
        filters.includeAllDayBlocks,
        filters.includeUncategorized,
        categories,
        filters.includeStatsExcludedCategories,
        filters.blockKind,
        filters.blockOutcome,
        filters.blockSource,
      );
  }, [
    categories,
    filters.blockKind,
    filters.blockOutcome,
    filters.blockSource,
    filters.categoryId,
    filters.includeAllDayBlocks,
    filters.includeStatsExcludedCategories,
    filters.includeUncategorized,
    filters.refreshKey,
    timeBlocks,
  ]);
  const periodBlocks = useMemo(
    () => getTimeBlocksInRange(filteredBlocks, range.start, range.end),
    [filteredBlocks, range.end, range.start],
  );
  const tasksDueInPeriod = useMemo(
    () => getTasksDueInRange(filteredTasks, range.start, range.end),
    [filteredTasks, range.end, range.start],
  );
  const overdueTasks = useMemo(() => getOverdueTasks(filteredTasks), [filteredTasks]);
  const statusTasks = useMemo(() => {
    const taskMap = new Map<string, Task>();
    tasksDueInPeriod.forEach((task) => taskMap.set(task.id, task));
    overdueTasks.forEach((task) => taskMap.set(task.id, task));
    return Array.from(taskMap.values());
  }, [overdueTasks, tasksDueInPeriod]);
  const dimensionHours = useMemo(
    () => calculateDimensionHours(periodBlocks, categories, filters.analyzeBy),
    [categories, filters.analyzeBy, periodBlocks],
  );
  const plannedHoursData = useMemo(
    () =>
      filters.range === "year"
        ? calculateMonthlyPlannedHours(
            periodBlocks,
            range.start.getFullYear(),
            filters.timeMode,
          )
        : calculateDailyPlannedHours(
            periodBlocks,
            range.start,
            range.end,
            filters.timeMode,
          ),
    [filters.range, filters.timeMode, periodBlocks, range.end, range.start],
  );
  const summary = useMemo(
    () =>
      calculateStatsSummary(
        filteredTasks,
        periodBlocks,
        categories,
        range.start,
        range.end,
        filters.timeMode,
      ),
    [categories, filteredTasks, filters.timeMode, periodBlocks, range.end, range.start],
  );
  const taskStatusStats = useMemo(
    () => calculateTaskStatusStats(statusTasks, range.start, range.end),
    [range.end, range.start, statusTasks],
  );
  const heatmapData = useMemo(
    () =>
      buildYearHeatmapData(
        filteredTasks,
        filteredBlocks,
        categories,
        range.start.getFullYear(),
      ),
    [categories, filteredBlocks, filteredTasks, range.start],
  );
  const selectedHeatmapDay = useMemo(
    () => getSelectedHeatmapDay(heatmapData, selectedStatsDate),
    [heatmapData, selectedStatsDate],
  );
  const yearBlocks = useMemo(
    () => getTimeBlocksInRange(filteredBlocks, range.start, range.end),
    [filteredBlocks, range.end, range.start],
  );
  const yearTasks = useMemo(
    () => getTasksDueInRange(filteredTasks, range.start, range.end),
    [filteredTasks, range.end, range.start],
  );
  const yearTotals = useMemo(
    () => getYearTotals(yearTasks, yearBlocks, categories),
    [categories, yearBlocks, yearTasks],
  );
  const kpis = [
    {
      label: "Normal Time",
      value: `${summary.activeHours.toFixed(1)}h`,
      detail: "Normal time blocks only",
    },
    {
      label: "Abandoned Time",
      value: `${summary.abandonedHours.toFixed(1)}h`,
      detail: "Abandoned blocks only",
    },
    {
      label: "Focus Time",
      value: `${summary.pomodoroHours.toFixed(1)}h`,
      detail: "Blocks from Pomodoro sessions",
    },
    {
      label: "Completed Tasks",
      value: summary.completedTasks.toString(),
      detail: "Done tasks due in this period",
    },
    {
      label: "Due Tasks",
      value: summary.dueTasks.toString(),
      detail: "Tasks due in this period",
    },
    {
      label: "Overdue Tasks",
      value: summary.overdueTasks.toString(),
      detail: "Open tasks due before today",
    },
    {
      label:
        filters.range === "week"
          ? "Average Per Day"
          : "Average Per Week",
      value:
        filters.range === "week"
          ? `${summary.averageSelectedHoursPerDay.toFixed(1)}h`
          : `${summary.averageSelectedHoursPerWeek.toFixed(1)}h`,
      detail:
        filters.range === "week"
          ? `${getTimeModeLabel(filters.timeMode)} time per day`
          : `${getTimeModeLabel(filters.timeMode)} time per week`,
    },
    {
      label: "Top Category",
      value: summary.mostActiveCategoryName ?? "None",
      detail: `Most ${getTimeModeLabel(filters.timeMode).toLowerCase()} hours`,
    },
  ];
  const analyzeByLabel = {
    category: "category",
    kind: "block kind",
    outcome: "outcome",
    source: "source",
  }[filters.analyzeBy];
  const hasPeriodData = periodBlocks.length > 0 || tasksDueInPeriod.length > 0;

  return (
    <div className="stats-view">
      <section className="stats-toolbar">
        <div>
          <div className="panel-kicker">{modeLabel[filters.range]} analytics</div>
          <h2>{range.label}</h2>
          <p>
            Normal time includes calendar and logged focus blocks.
            Abandoned time is counted separately.
          </p>
        </div>
      </section>

      <StatsKpiGrid items={kpis} />

      {!hasPeriodData ? (
        <div className="empty-state stats-empty-state">
          No stats data for this period. Adjust the sidebar filters or add time
          blocks and due tasks in the selected range.
        </div>
      ) : null}

      <div className="stats-grid">
        <CategoryHoursChart
          data={dimensionHours}
          kicker="Analyze by"
          title={`Hours by ${analyzeByLabel}`}
        />
        <DailyPlannedHoursChart
          data={plannedHoursData}
          title={getPlannedHoursTitle(filters.range, filters.timeMode)}
        />
        <TaskCompletionChart stats={taskStatusStats} />

        {filters.range === "year" ? (
          <>
            <YearHeatmap
              data={heatmapData}
              metric={filters.heatmapMetric}
              onSelectDate={onSelectStatsDate}
              selectedDate={selectedStatsDate}
              year={range.start.getFullYear()}
            />
            <YearTotalsPanel totals={yearTotals} />
            <SelectedDayStats day={selectedHeatmapDay} />
          </>
        ) : null}
      </div>
    </div>
  );
}

export default StatsView;
