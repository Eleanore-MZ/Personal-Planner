import { useMemo, type ReactNode } from "react";
import type { StatsFilters, WeekStartDay } from "../../types/app";
import type { Category, StatsGroup, Task, TimeBlock } from "../../types/domain";
import CategoryHoursChart from "./CategoryHoursChart";
import DailyPlannedHoursChart from "./DailyPlannedHoursChart";
import HourOfDayChart from "./HourOfDayChart";
import MonthActivityMap, { type MonthActivityDay } from "./MonthActivityMap";
import SelectedDayStats from "./SelectedDayStats";
import SleepByDayChart from "./SleepByDayChart";
import StatsKpiGrid from "./StatsKpiGrid";
import TaskCompletionChart from "./TaskCompletionChart";
import TimeGroupsSummary from "./TimeGroupsSummary";
import WeekRhythmStrip from "./WeekRhythmStrip";
import YearHeatmap from "./YearHeatmap";
import YearTotalsPanel from "./YearTotalsPanel";
import {
  buildYearHeatmapData,
  calculateCategoryHours,
  calculateDailySleepHours,
  calculateDailyPlannedHours,
  calculateDailyStatsGroupHours,
  calculateHourOfDayActivity,
  calculateDimensionHours,
  calculateMonthlyPlannedHours,
  calculateSleepStats,
  calculateStatsSummary,
  calculateTaskStatusStats,
  calculateTimeOfDaySummary,
  calculateTimeGroupHours,
  calculateTotalPlannedHours,
  calculateWeeklyStatsGroupHours,
  calculateWeekRhythm,
  filterBlocksByStatsGroupProductiveTime,
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
  statsGroups: StatsGroup[];
  tasks: Task[];
  timeBlocks: TimeBlock[];
  weekStartDay: WeekStartDay;
  onSelectStatsDate: (date: Date) => void;
};

type StatsSectionProps = {
  children: ReactNode;
  kicker: string;
  title: string;
};

const modeLabel = {
  week: "Week",
  month: "Month",
  year: "Year",
};

function StatsSection({ children, kicker, title }: StatsSectionProps) {
  return (
    <section aria-label={title} className="stats-section">
      <div className="stats-section-header">
        <div className="panel-kicker">{kicker}</div>
      </div>
      {children}
    </section>
  );
}

const weekdayChartFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

const oneDayMs = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getPeriodDayCount(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / oneDayMs));
}

function getElapsedPeriodDayCount(start: Date, end: Date, currentDate = new Date()) {
  const dayCount = getPeriodDayCount(start, end);
  const rangeStart = startOfLocalDay(start).getTime();
  const rangeEnd = end.getTime();
  const todayStart = startOfLocalDay(currentDate).getTime();

  if (todayStart >= rangeStart && todayStart < rangeEnd) {
    return Math.max(1, Math.min(dayCount, Math.floor((todayStart - rangeStart) / oneDayMs) + 1));
  }

  return dayCount;
}

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
  statsGroups,
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
  const trackedActiveBlocks = useMemo(
    () =>
      periodBlocks.filter(
        (block) => block.outcome === "active" && !block.isAllDay,
      ),
    [periodBlocks],
  );
  const abandonedBlocks = useMemo(
    () =>
      periodBlocks.filter(
        (block) => block.outcome === "abandoned" && !block.isAllDay,
      ),
    [periodBlocks],
  );
  const productiveActiveBlocks = useMemo(
    () =>
      filterBlocksByStatsGroupProductiveTime(
        trackedActiveBlocks,
        categories,
        statsGroups,
      ),
    [categories, statsGroups, trackedActiveBlocks],
  );
  const productiveChartBlocks = useMemo(
    () => (filters.showAllTrackedTime ? trackedActiveBlocks : productiveActiveBlocks),
    [filters.showAllTrackedTime, productiveActiveBlocks, trackedActiveBlocks],
  );
  const productiveSummaryBlocks = useMemo(
    () => [...productiveActiveBlocks, ...abandonedBlocks],
    [abandonedBlocks, productiveActiveBlocks],
  );
  const tasksDueInPeriod = useMemo(
    () => getTasksDueInRange(filteredTasks, range.start, range.end),
    [filteredTasks, range.end, range.start],
  );
  const summaryTasks = useMemo(
    () =>
      filterStatsTasks(
        tasks,
        filters.categoryId,
        true,
        filters.includeUncategorized,
        categories,
        filters.includeStatsExcludedCategories,
      ),
    [
      categories,
      filters.categoryId,
      filters.includeStatsExcludedCategories,
      filters.includeUncategorized,
      tasks,
    ],
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
  const weekCategoryHours = useMemo(
    () =>
      calculateCategoryHours(trackedActiveBlocks, categories, "active").filter(
        (category) => category.hours > 0,
      ),
    [categories, trackedActiveBlocks],
  );
  const weekTimeGroups = useMemo(
    () => calculateTimeGroupHours(trackedActiveBlocks, categories, statsGroups),
    [categories, statsGroups, trackedActiveBlocks],
  );
  const monthCategoryHours = useMemo(
    () =>
      calculateCategoryHours(trackedActiveBlocks, categories, "active").filter(
        (category) => category.hours > 0,
      ),
    [categories, trackedActiveBlocks],
  );
  const monthTimeGroups = useMemo(
    () => calculateTimeGroupHours(trackedActiveBlocks, categories, statsGroups),
    [categories, statsGroups, trackedActiveBlocks],
  );
  const weekHourOfDayData = useMemo(
    () => calculateHourOfDayActivity(productiveChartBlocks, range.start, range.end),
    [productiveChartBlocks, range.end, range.start],
  );
  const weekTimeOfDaySummary = useMemo(
    () => calculateTimeOfDaySummary(weekHourOfDayData),
    [weekHourOfDayData],
  );
  const weekRhythm = useMemo(
    () =>
      calculateWeekRhythm(
        trackedActiveBlocks,
        range.start,
        categories,
        statsGroups,
      ),
    [categories, range.start, statsGroups, trackedActiveBlocks],
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
  const weekDailyProductiveHoursData = useMemo(
    () =>
      calculateDailyStatsGroupHours(
        productiveChartBlocks,
        range.start,
        range.end,
        categories,
        statsGroups,
        "active",
      ).map((day) => ({
        ...day,
        label: weekdayChartFormatter.format(new Date(day.date)),
      })),
    [categories, productiveChartBlocks, range.end, range.start, statsGroups],
  );
  const monthWeeklyProductiveHoursData = useMemo(
    () =>
      calculateWeeklyStatsGroupHours(
        productiveActiveBlocks,
        range.start,
        range.end,
        categories,
        statsGroups,
        "active",
      ),
    [categories, productiveActiveBlocks, range.end, range.start, statsGroups],
  );
  const monthActivityDays = useMemo<MonthActivityDay[]>(() => {
    if (filters.range !== "month") {
      return [];
    }

    const productiveDays = calculateDailyPlannedHours(
      productiveActiveBlocks,
      range.start,
      range.end,
      "active",
    );
    const trackedDays = calculateDailyPlannedHours(
      trackedActiveBlocks,
      range.start,
      range.end,
      "active",
    );
    const focusDays = calculateDailyPlannedHours(
      trackedActiveBlocks.filter((block) => block.source === "pomodoro"),
      range.start,
      range.end,
      "active",
    );

    return productiveDays.map((day, index) => ({
      date: day.date,
      dayOfMonth: new Date(day.date).getDate(),
      focusHours: focusDays[index]?.hours ?? 0,
      productiveHours: day.hours,
      trackedHours: trackedDays[index]?.hours ?? 0,
    }));
  }, [
    filters.range,
    productiveActiveBlocks,
    range.end,
    range.start,
    trackedActiveBlocks,
  ]);
  const monthHourOfDayData = useMemo(
    () => calculateHourOfDayActivity(productiveActiveBlocks, range.start, range.end),
    [productiveActiveBlocks, range.end, range.start],
  );
  const monthTimeOfDaySummary = useMemo(
    () => calculateTimeOfDaySummary(monthHourOfDayData),
    [monthHourOfDayData],
  );
  const monthSleepByDayData = useMemo(
    () =>
      calculateDailySleepHours(
        trackedActiveBlocks,
        categories,
        statsGroups,
        range.start,
        range.end,
      ),
    [categories, range.end, range.start, statsGroups, trackedActiveBlocks],
  );
  const summary = useMemo(
    () =>
      calculateStatsSummary(
        summaryTasks,
        filters.range === "year" ? periodBlocks : productiveSummaryBlocks,
        categories,
        range.start,
        range.end,
        filters.timeMode,
      ),
    [
      categories,
      productiveSummaryBlocks,
      filters.range,
      filters.timeMode,
      periodBlocks,
      range.end,
      range.start,
      summaryTasks,
    ],
  );
  const trackedSummary = useMemo(
    () =>
      calculateStatsSummary(
        summaryTasks,
        trackedActiveBlocks,
        categories,
        range.start,
        range.end,
        filters.timeMode,
      ),
    [
      categories,
      filters.timeMode,
      range.end,
      range.start,
      summaryTasks,
      trackedActiveBlocks,
    ],
  );
  const sleepStats = useMemo(
    () =>
      calculateSleepStats(
        trackedActiveBlocks,
        categories,
        statsGroups,
        range.start,
        range.end,
        filters.range === "month" ? "period-days" : "logged-days",
      ),
    [categories, filters.range, range.end, range.start, statsGroups, trackedActiveBlocks],
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
  const completionRate =
    summary.dueTasks > 0
      ? Math.round((summary.completedTasks / summary.dueTasks) * 100)
      : 0;
  const sleepRangeDetail =
    sleepStats.shortestDay && sleepStats.longestDay
      ? ` - low ${sleepStats.shortestDay.label} ${sleepStats.shortestDay.hours.toFixed(
          1,
        )}h - high ${sleepStats.longestDay.label} ${sleepStats.longestDay.hours.toFixed(1)}h`
      : "";
  const sleepDaysDetail =
    sleepStats.averageDayCount === 7
      ? `${sleepStats.daysLogged} / 7 days logged`
      : `${sleepStats.daysLogged} days logged - avg over ${sleepStats.averageDayCount} days`;
  const monthAverageDayCount = getElapsedPeriodDayCount(range.start, range.end);
  const monthCompletionRate =
    summary.dueTasks > 0
      ? Math.round((summary.completedTasks / summary.dueTasks) * 100)
      : 0;
  const weekKpis = [
    {
      label: "Productive time",
      value: `${summary.activeHours.toFixed(1)}h`,
      detail: `${summary.activeDaysCount} / 7 productive days`,
    },
    {
      label: "Tracked time",
      value: `${trackedSummary.activeHours.toFixed(1)}h`,
      detail: "Includes non-productive groups",
    },
    {
      label: "Average/day",
      value: `${(summary.activeHours / 7).toFixed(1)}h`,
      detail: "Productive time divided by 7",
    },
    {
      label: "Avg sleep",
      value:
        sleepStats.totalHours > 0
          ? `${sleepStats.averageHoursPerDay.toFixed(1)}h/day`
          : "No sleep data",
      detail: `${sleepDaysDetail}${sleepRangeDetail}`,
    },
    {
      label: "Tasks due completion",
      value:
        summary.dueTasks > 0
          ? `${summary.completedTasks} / ${summary.dueTasks} (${completionRate}%)`
          : "0 / 0",
      detail: summary.dueTasks > 0 ? "Done out of due tasks" : "No due tasks",
    },
    {
      label: "Abandoned time",
      value: `${summary.abandonedHours.toFixed(1)}h`,
      detail: "Abandoned blocks only",
    },
  ];
  const defaultKpis = [
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
  const monthKpis = [
    {
      label: "Productive time",
      value: `${summary.activeHours.toFixed(1)}h`,
      detail: "Productive groups only",
    },
    {
      label: "Tracked time",
      value: `${trackedSummary.activeHours.toFixed(1)}h`,
      detail: "Includes non-productive groups",
    },
    {
      label: "Average/day",
      value: `${(summary.activeHours / monthAverageDayCount).toFixed(1)}h`,
      detail: `Productive time over ${monthAverageDayCount} days`,
    },
    {
      label: "Avg sleep",
      value:
        sleepStats.totalHours > 0
          ? `${sleepStats.averageHoursPerDay.toFixed(1)}h/day`
          : "No sleep data",
      detail: `${sleepStats.daysLogged} days logged - avg over ${sleepStats.averageDayCount} days${sleepRangeDetail}`,
    },
    {
      label: "Tasks due completion",
      value:
        summary.dueTasks > 0
          ? `${summary.completedTasks} / ${summary.dueTasks} (${monthCompletionRate}%)`
          : "0 / 0",
      detail: summary.dueTasks > 0 ? "Done out of due tasks" : "No due tasks",
    },
    {
      label: "Abandoned time",
      value: `${summary.abandonedHours.toFixed(1)}h`,
      detail: "Abandoned blocks only",
    },
  ];
  const kpis =
    filters.range === "week"
      ? weekKpis
      : filters.range === "month"
        ? monthKpis
        : defaultKpis;
  const analyzeByLabel = {
    category: "category",
    kind: "block kind",
    outcome: "outcome",
    source: "source",
  }[filters.analyzeBy];
  const hasPeriodData = periodBlocks.length > 0 || tasksDueInPeriod.length > 0;
  const categoryChartData =
    filters.range === "week"
      ? weekCategoryHours
      : filters.range === "month"
        ? monthCategoryHours
        : dimensionHours;
  const dailyChartData =
    filters.range === "week"
      ? weekDailyProductiveHoursData
      : filters.range === "month"
        ? monthWeeklyProductiveHoursData
        : plannedHoursData;
  const categoryChartTitle =
    filters.range === "week"
      ? "Hours by category"
      : filters.range === "month"
        ? "Hours by category"
      : `Hours by ${analyzeByLabel}`;
  const dailyChartTitle =
    filters.range === "week"
      ? filters.showAllTrackedTime
        ? "Tracked time by weekday"
        : "Productive time by weekday"
      : filters.range === "month"
        ? "Productive time by week"
      : getPlannedHoursTitle(filters.range, filters.timeMode);
  const hasProductiveTime = summary.activeHours > 0;
  const hasDueTasks = summary.dueTasks > 0;
  const hasFocusTime = summary.pomodoroHours > 0;

  const weekStatsContent = (
    <>
      <StatsSection kicker="Overview" title="Overview">
        <StatsKpiGrid items={kpis} />
        {!hasProductiveTime ? (
          <div className="empty-state stats-empty-state">
            No productive time for this week. Add active time blocks, adjust
            the sidebar filters, or mark relevant Stats Groups as productive.
          </div>
        ) : null}
      </StatsSection>

      <StatsSection kicker="Time breakdown" title="Time breakdown">
        <div className="stats-section-grid time-breakdown-grid">
          <TimeGroupsSummary
            groups={weekTimeGroups}
            metricLabel="Tracked Time"
          />
          <CategoryHoursChart
            data={categoryChartData}
            emptyMessage="No tracked category data for this week under the current filters."
            hideZeroHours
            kicker="Tracked categories"
            title={categoryChartTitle}
          />
        </div>
      </StatsSection>

      <StatsSection kicker="Patterns" title="Patterns">
        <div className="stats-section-grid patterns-grid">
          <DailyPlannedHoursChart
            compact
            data={dailyChartData}
            emptyMessage={
              filters.showAllTrackedTime
                ? "No tracked time for this week under the current filters."
                : "No productive time for this week under the current filters."
            }
            highlightMax
            kicker={
              filters.showAllTrackedTime
                ? "Weekday tracked time"
                : "Weekday productive time"
            }
            title={dailyChartTitle}
          />
          <HourOfDayChart
            data={weekHourOfDayData}
            emptyMessage={
              filters.showAllTrackedTime
                ? "No tracked hourly time for this week under the current filters."
                : "No productive hourly time for this week under the current filters."
            }
            metricLabel={filters.showAllTrackedTime ? "tracked" : "productive"}
            summaries={weekTimeOfDaySummary}
            title={
              filters.showAllTrackedTime
                ? "Tracked time by hour of day"
                : "Productive time by hour of day"
            }
          />
        </div>
      </StatsSection>

      <StatsSection kicker="Week rhythm" title="Week rhythm">
        <WeekRhythmStrip
          days={weekRhythm}
          title="Weekly rhythm"
        />
      </StatsSection>

      <StatsSection kicker="Tasks and focus" title="Tasks / focus details">
        <div className="stats-section-grid compact">
          <TaskCompletionChart
            emptyMessage="No due tasks for this week under the current filters."
            stats={taskStatusStats}
          />
          <div className="stats-card stats-detail-card">
            <div className="stats-card-header">
              <div>
                <div className="panel-kicker">Focus</div>
                <h2>Focus time</h2>
              </div>
            </div>
            {hasFocusTime ? (
              <div className="focus-detail-value">
                <strong>{summary.pomodoroHours.toFixed(1)}h</strong>
                <span>Active Pomodoro time in this week</span>
              </div>
            ) : (
              <div className="empty-state">
                No focus time for this week. Pomodoro blocks will appear here
                once they are active and match the current filters.
              </div>
            )}
          </div>
        </div>
        {!hasDueTasks ? (
          <div className="empty-state stats-empty-state">
            No due tasks for this week under the current filters.
          </div>
        ) : null}
      </StatsSection>
    </>
  );

  const monthStatsContent = (
    <>
      <StatsSection kicker="Overview" title="Overview">
        <StatsKpiGrid items={kpis} />
        {!hasProductiveTime ? (
          <div className="empty-state stats-empty-state">
            No productive time for this month. Add active time blocks or mark
            relevant Stats Groups as productive.
          </div>
        ) : null}
      </StatsSection>

      <StatsSection kicker="Time breakdown" title="Time breakdown">
        <div className="stats-section-grid time-breakdown-grid">
          <TimeGroupsSummary
            groups={monthTimeGroups}
            metricLabel="Tracked Time"
          />
          <CategoryHoursChart
            data={monthCategoryHours}
            emptyMessage="No tracked category data for this month under the current filters."
            hideZeroHours
            kicker="Tracked categories"
            title="Hours by category"
          />
        </div>
      </StatsSection>

      <StatsSection kicker="Trends" title="Trends">
        <div className="stats-section-grid">
          <DailyPlannedHoursChart
            data={monthWeeklyProductiveHoursData}
            emptyMessage="No productive time for this month under the current filters."
            kicker="Monthly trend"
            showInsights={false}
            title="Productive time by week"
          />
          <TaskCompletionChart stats={taskStatusStats} />
          <MonthActivityMap days={monthActivityDays} />
        </div>
      </StatsSection>

      <StatsSection kicker="Rhythm and sleep" title="Rhythm and sleep">
        <div className="stats-section-grid">
          <HourOfDayChart
            data={monthHourOfDayData}
            emptyMessage="No productive hourly time for this month under the current filters."
            metricLabel="productive"
            summaries={monthTimeOfDaySummary}
            title="Productive time by hour of day"
          />
          <SleepByDayChart data={monthSleepByDayData} />
        </div>
      </StatsSection>
    </>
  );

  return (
    <div className="stats-view">
      <section className="stats-toolbar">
        <div>
          <div className="panel-kicker">{modeLabel[filters.range]} analytics</div>
          <h2>{range.label}</h2>
          <p>
            {filters.range === "week"
              ? "Productive time excludes non-productive Stats Groups. Tracked time still includes active sleep, meal, and rest blocks for distribution views."
              : filters.range === "month"
                ? "Productive time uses productive Stats Groups. Tracked time includes active sleep, meal, and rest blocks; abandoned time stays separate."
                : "Normal time includes calendar and logged focus blocks. Abandoned time is counted separately."}
          </p>
        </div>
      </section>

      {filters.range === "week" ? (
        weekStatsContent
      ) : filters.range === "month" ? (
        monthStatsContent
      ) : (
        <>
          <StatsKpiGrid items={kpis} />

          {!hasPeriodData ? (
            <div className="empty-state stats-empty-state">
              No stats data for this period. Adjust the sidebar filters or add
              time blocks and due tasks in the selected range.
            </div>
          ) : null}

          <div className="stats-grid">
            <CategoryHoursChart
              data={categoryChartData}
              emptyMessage="No time block hours match the selected period and filters."
              kicker="Analyze by"
              title={categoryChartTitle}
            />
            <DailyPlannedHoursChart
              data={dailyChartData}
              title={dailyChartTitle}
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
        </>
      )}
    </div>
  );
}

export default StatsView;
