import { useMemo, useState, type ReactNode } from "react";
import type { StatsFilters, WeekStartDay } from "../../types/app";
import type { Category, StatsGroup, Task, TimeBlock } from "../../types/domain";
import { addCalendarDays } from "../../utils/calendar";
import CategoryHoursChart from "./CategoryHoursChart";
import DailyPlannedHoursChart from "./DailyPlannedHoursChart";
import HourOfDayChart from "./HourOfDayChart";
import MonthActivityMap, { type MonthActivityDay } from "./MonthActivityMap";
import PressureLevelChart from "./PressureLevelChart";
import SelectedDayStats from "./SelectedDayStats";
import SleepByDayChart from "./SleepByDayChart";
import StatsKpiGrid from "./StatsKpiGrid";
import TimeGroupsSummary from "./TimeGroupsSummary";
import WeekRhythmStrip from "./WeekRhythmStrip";
import YearHeatmap from "./YearHeatmap";
import YearSummaryPanel from "./YearSummaryPanel";
import {
  buildYearHeatmapData,
  calculateCategoryHours,
  calculateDailySleepHours,
  calculateDailyPlannedHours,
  calculateDailyStatsGroupHours,
  calculateHourOfDayActivity,
  calculateMonthlyPlannedHours,
  calculateMonthlyStatsGroupHours,
  calculatePressureLevel,
  calculateYearPressureLevel,
  calculateSleepStats,
  calculateStatsSummary,
  calculateTimeOfDaySummary,
  calculateTimeGroupHours,
  calculateWeeklyStatsGroupHours,
  calculateWeekRhythm,
  filterBlocksByStatsGroupProductiveTime,
  filterStatsTasks,
  filterStatsTimeBlocks,
  getSelectedHeatmapDay,
  getRecordedTimeBlockDayCount,
  getStatsRange,
  getTasksDueInRange,
  getTimeBlocksInRange,
  getYearStatsCoverageWindow,
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
const summaryDayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
});
function formatHours(hours: number) {
  return `${hours.toFixed(1)}h`;
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
  const periodRecordedDayCount = useMemo(
    () => getRecordedTimeBlockDayCount(timeBlocks, range.start, range.end),
    [range.end, range.start, timeBlocks],
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
  const pressureTasks = useMemo(
    () => {
      if (filters.refreshKey < 0) {
        return [];
      }

      return filterStatsTasks(
        tasks,
        filters.categoryId,
        true,
        filters.includeUncategorized,
        categories,
        filters.includeStatsExcludedCategories,
      );
    },
    [
      categories,
      filters.categoryId,
      filters.includeStatsExcludedCategories,
      filters.includeUncategorized,
      filters.refreshKey,
      tasks,
    ],
  );
  const pressureBlocks = useMemo(
    () => {
      if (filters.refreshKey < 0) {
        return [];
      }

      return filterStatsTimeBlocks(
        timeBlocks,
        filters.categoryId,
        false,
        filters.includeUncategorized,
        categories,
        filters.includeStatsExcludedCategories,
        "all",
        filters.blockOutcome,
        "all",
      );
    },
    [
      categories,
      filters.blockOutcome,
      filters.categoryId,
      filters.includeStatsExcludedCategories,
      filters.includeUncategorized,
      filters.refreshKey,
      timeBlocks,
    ],
  );
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
  const weekCategoryHours = useMemo(
    () =>
      calculateCategoryHours(trackedActiveBlocks, categories, "active"),
    [categories, trackedActiveBlocks],
  );
  const weekTimeGroups = useMemo(
    () => calculateTimeGroupHours(trackedActiveBlocks, categories, statsGroups),
    [categories, statsGroups, trackedActiveBlocks],
  );
  const monthCategoryHours = useMemo(
    () =>
      calculateCategoryHours(trackedActiveBlocks, categories, "active"),
    [categories, trackedActiveBlocks],
  );
  const monthTimeGroups = useMemo(
    () => calculateTimeGroupHours(trackedActiveBlocks, categories, statsGroups),
    [categories, statsGroups, trackedActiveBlocks],
  );
  const yearCategoryHours = useMemo(
    () =>
      calculateCategoryHours(trackedActiveBlocks, categories, "active"),
    [categories, trackedActiveBlocks],
  );
  const yearTimeGroups = useMemo(
    () => calculateTimeGroupHours(trackedActiveBlocks, categories, statsGroups),
    [categories, statsGroups, trackedActiveBlocks],
  );
  const yearProductiveGroups = useMemo(
    () => calculateTimeGroupHours(productiveActiveBlocks, categories, statsGroups),
    [categories, productiveActiveBlocks, statsGroups],
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
  const yearMonthlyTrackedGroupHours = useMemo(
    () =>
      calculateMonthlyStatsGroupHours(
        trackedActiveBlocks,
        range.start.getFullYear(),
        categories,
        statsGroups,
        "active",
      ),
    [categories, range.start, statsGroups, trackedActiveBlocks],
  );
  const weekDailyProductiveHoursData = useMemo(
    () =>
      calculateDailyStatsGroupHours(
        trackedActiveBlocks,
        range.start,
        range.end,
        categories,
        statsGroups,
        "active",
      ).map((day) => ({
        ...day,
        label: weekdayChartFormatter.format(new Date(day.date)),
      })),
    [categories, range.end, range.start, statsGroups, trackedActiveBlocks],
  );
  const monthWeeklyProductiveHoursData = useMemo(
    () =>
      calculateWeeklyStatsGroupHours(
        trackedActiveBlocks,
        range.start,
        range.end,
        categories,
        statsGroups,
        "active",
      ),
    [categories, range.end, range.start, statsGroups, trackedActiveBlocks],
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
    return productiveDays.map((day, index) => ({
      date: day.date,
      dayOfMonth: new Date(day.date).getDate(),
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
  const monthPressureData = useMemo(
    () =>
      calculatePressureLevel(
        pressureTasks,
        pressureBlocks,
        range.start,
        range.end,
      ),
    [pressureBlocks, pressureTasks, range.end, range.start],
  );
  const yearSleepByMonthData = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) => {
        const monthStart = new Date(range.start.getFullYear(), month, 1);
        const monthEnd = new Date(range.start.getFullYear(), month + 1, 1);
        const monthRecordedDayCount = getRecordedTimeBlockDayCount(
          timeBlocks,
          monthStart,
          monthEnd,
        );
        const monthlySleep = calculateSleepStats(
          trackedActiveBlocks,
          categories,
          statsGroups,
          monthStart,
          monthEnd,
          "period-days",
          monthRecordedDayCount,
        );

        return {
          date: monthStart.toISOString(),
          label: monthStart.toLocaleString("en-US", { month: "short" }),
          hours:
            monthlySleep.totalHours > 0 ? monthlySleep.averageHoursPerDay : 0,
        };
      }),
    [categories, range.start, statsGroups, timeBlocks, trackedActiveBlocks],
  );
  const yearHourOfDayData = useMemo(
    () => calculateHourOfDayActivity(productiveActiveBlocks, range.start, range.end),
    [productiveActiveBlocks, range.end, range.start],
  );
  const yearTimeOfDaySummary = useMemo(
    () => calculateTimeOfDaySummary(yearHourOfDayData),
    [yearHourOfDayData],
  );
  const summary = useMemo(
    () =>
      calculateStatsSummary(
        summaryTasks,
        productiveSummaryBlocks,
        categories,
        range.start,
        range.end,
        filters.timeMode,
        undefined,
        periodRecordedDayCount,
      ),
    [
      categories,
      productiveSummaryBlocks,
      filters.timeMode,
      periodRecordedDayCount,
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
        undefined,
        periodRecordedDayCount,
      ),
    [
      categories,
      filters.timeMode,
      periodRecordedDayCount,
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
        filters.range === "week" ? "logged-days" : "period-days",
        periodRecordedDayCount,
      ),
    [
      categories,
      filters.range,
      periodRecordedDayCount,
      range.end,
      range.start,
      statsGroups,
      trackedActiveBlocks,
    ],
  );
  const heatmapData = useMemo(
    () =>
      buildYearHeatmapData(
        filteredBlocks,
        categories,
        statsGroups,
        range.start.getFullYear(),
      ),
    [categories, filteredBlocks, range.start, statsGroups],
  );
  const yearPressureData = useMemo(
    () =>
      calculateYearPressureLevel(
        pressureTasks,
        pressureBlocks,
        range.start.getFullYear(),
      ),
    [pressureBlocks, pressureTasks, range.start],
  );
  const [previewStatsDate, setPreviewStatsDate] = useState<Date | undefined>();
  const selectedHeatmapDay = useMemo(
    () => getSelectedHeatmapDay(heatmapData, selectedStatsDate),
    [heatmapData, selectedStatsDate],
  );
  const previewHeatmapDay = useMemo(
    () =>
      previewStatsDate
        ? getSelectedHeatmapDay(heatmapData, previewStatsDate)
        : undefined,
    [heatmapData, previewStatsDate],
  );
  const visibleHeatmapDay = previewHeatmapDay ?? selectedHeatmapDay;
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
  const sleepDaysDetail = `${sleepStats.daysLogged} days logged - avg over ${sleepStats.averageDayCount} recorded days`;
  const yearCoverageWindow = useMemo(
    () => getYearStatsCoverageWindow(timeBlocks, range.start.getFullYear()),
    [range.start, timeBlocks],
  );
  const yearAverageDayCount = yearCoverageWindow?.dayCount ?? 0;
  const yearCoverageWeeksDetail = yearCoverageWindow
    ? `over ${yearCoverageWindow.weekCount.toFixed(1)} equivalent recorded weeks`
    : "No recorded weeks yet";
  const yearMonthlyProductiveHours = useMemo(
    () =>
      calculateMonthlyPlannedHours(
        productiveActiveBlocks,
        range.start.getFullYear(),
        "active",
      ),
    [productiveActiveBlocks, range.start],
  );
  const mostProductiveMonth = useMemo(
    () =>
      yearMonthlyProductiveHours.reduce<(typeof yearMonthlyProductiveHours)[number] | null>(
        (current, month) => (!current || month.hours > current.hours ? month : current),
        null,
      ),
    [yearMonthlyProductiveHours],
  );
  const yearDailyProductiveHours = useMemo(
    () =>
      calculateDailyPlannedHours(
        productiveActiveBlocks,
        range.start,
        range.end,
        "active",
      ).map((day) => ({
        ...day,
        label: summaryDayFormatter.format(new Date(day.date)),
      })),
    [productiveActiveBlocks, range.end, range.start],
  );
  const yearProductiveDays = useMemo(
    () => yearDailyProductiveHours.filter((day) => day.hours > 0).length,
    [yearDailyProductiveHours],
  );
  const yearDailyTrackedHours = useMemo(
    () =>
      calculateDailyPlannedHours(
        trackedActiveBlocks,
        range.start,
        range.end,
        "active",
      ),
    [range.end, range.start, trackedActiveBlocks],
  );
  const yearTrackedDays = useMemo(
    () => yearDailyTrackedHours.filter((day) => day.hours > 0).length,
    [yearDailyTrackedHours],
  );
  const topProductiveGroup = useMemo(
    () =>
      yearProductiveGroups.reduce<(typeof yearProductiveGroups)[number] | null>(
        (current, group) => (!current || group.hours > current.hours ? group : current),
        null,
      ),
    [yearProductiveGroups],
  );
  const topTrackedCategory = useMemo(
    () =>
      yearCategoryHours.reduce<(typeof yearCategoryHours)[number] | null>(
        (currentCategory, category) =>
          category.hours > (currentCategory?.hours ?? 0)
            ? category
            : currentCategory,
        null,
      ),
    [yearCategoryHours],
  );
  const highestProductiveDay = useMemo(
    () =>
      yearDailyProductiveHours.reduce<(typeof yearDailyProductiveHours)[number] | null>(
        (current, day) => (!current || day.hours > current.hours ? day : current),
        null,
      ),
    [yearDailyProductiveHours],
  );
  const yearCoverageSleepStats = useMemo(
    () =>
      yearCoverageWindow
        ? calculateSleepStats(
            trackedActiveBlocks,
            categories,
            statsGroups,
            yearCoverageWindow.start,
            addCalendarDays(yearCoverageWindow.end, 1),
            "period-days",
            yearCoverageWindow.dayCount,
          )
        : null,
    [categories, statsGroups, trackedActiveBlocks, yearCoverageWindow],
  );
  const monthCompletionRate =
    summary.dueTasks > 0
      ? Math.round((summary.completedTasks / summary.dueTasks) * 100)
      : 0;
  const weekKpis = [
    {
      label: "Productive time",
      value: formatHours(summary.activeHours),
      detail: `${summary.activeDaysCount} / 7 productive days`,
    },
    {
      label: "Tracked time",
      value: formatHours(trackedSummary.activeHours),
      detail: "Includes non-productive groups",
    },
    {
      label: "Average/day",
      value: formatHours(summary.averageSelectedHoursPerDay),
      detail:
        periodRecordedDayCount > 0
          ? `Productive time over ${periodRecordedDayCount} recorded days`
          : "No recorded days yet",
    },
    {
      label: "Avg sleep",
      value:
        sleepStats.totalHours > 0
          ? `${sleepStats.averageHoursPerDay.toFixed(1)}h/day`
          : "No sleep logged",
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
      value: formatHours(summary.abandonedHours),
      detail: "Abandoned blocks only",
    },
  ];
  const yearKpis = [
    {
      label: "Productive time",
      value: formatHours(summary.activeHours),
      detail: "Tracked time in productive Stats Groups",
    },
    {
      label: "Tracked time",
      value: formatHours(trackedSummary.activeHours),
      detail: "Active non-all-day stat-included blocks",
    },
    {
      label: "Avg productive/week",
      value: formatHours(summary.averageSelectedHoursPerWeek),
      detail: yearCoverageWeeksDetail,
    },
    {
      label: "Avg productive/day",
      value: formatHours(summary.averageSelectedHoursPerDay),
      detail: yearAverageDayCount > 0
        ? `Productive time over ${yearAverageDayCount} recorded days`
        : "No recorded days yet",
    },
    {
      label: "Avg sleep",
      value:
        yearCoverageSleepStats && yearCoverageSleepStats.totalHours > 0
          ? `${yearCoverageSleepStats.averageHoursPerDay.toFixed(1)}h/day`
          : "No sleep logged",
      detail: yearCoverageSleepStats
        ? `${yearCoverageSleepStats.daysLogged} days logged - avg over ${yearCoverageSleepStats.averageDayCount} recorded days`
        : "No recorded days yet",
    },
    {
      label: "Most productive month",
      value:
        mostProductiveMonth && mostProductiveMonth.hours > 0
          ? mostProductiveMonth.label
          : "None",
      detail:
        mostProductiveMonth && mostProductiveMonth.hours > 0
          ? `${formatHours(mostProductiveMonth.hours)} productive`
          : "No productive month yet",
    },
  ];
  const monthKpis = [
    {
      label: "Productive time",
      value: formatHours(summary.activeHours),
      detail: "Productive groups only",
    },
    {
      label: "Tracked time",
      value: formatHours(trackedSummary.activeHours),
      detail: "Includes non-productive groups",
    },
    {
      label: "Average/day",
      value: formatHours(summary.averageSelectedHoursPerDay),
      detail:
        periodRecordedDayCount > 0
          ? `Productive time over ${periodRecordedDayCount} recorded days`
          : "No recorded days yet",
    },
    {
      label: "Avg sleep",
      value:
        sleepStats.totalHours > 0
          ? `${sleepStats.averageHoursPerDay.toFixed(1)}h/day`
          : "No sleep logged",
      detail: `${sleepStats.daysLogged} days logged - avg over ${sleepStats.averageDayCount} recorded days${sleepRangeDetail}`,
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
      value: formatHours(summary.abandonedHours),
      detail: "Abandoned blocks only",
    },
  ];
  const kpis =
    filters.range === "week"
      ? weekKpis
      : filters.range === "month"
        ? monthKpis
        : yearKpis;
  const hasPeriodData = periodBlocks.length > 0 || tasksDueInPeriod.length > 0;
  const categoryChartData =
    filters.range === "week"
      ? weekCategoryHours
      : filters.range === "month"
        ? monthCategoryHours
        : yearCategoryHours;
  const dailyChartData =
    filters.range === "week"
      ? weekDailyProductiveHoursData
      : filters.range === "month"
        ? monthWeeklyProductiveHoursData
        : yearMonthlyTrackedGroupHours;
  const categoryChartTitle =
    filters.range === "week"
      ? "Hours by category"
      : filters.range === "month"
        ? "Hours by category"
      : "Tracked hours by category";
  const dailyChartTitle =
    filters.range === "week"
      ? "Tracked time by weekday"
      : filters.range === "month"
        ? "Tracked time by week"
      : "Tracked total time by stats group";
  const hasProductiveTime = summary.activeHours > 0;

  const weekStatsContent = (
    <>
      <StatsSection kicker="Overview" title="Overview">
        <StatsKpiGrid items={kpis} />
        {!hasProductiveTime ? (
          <div className="empty-state stats-empty-state">
            No productive time for this week.
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
            emptyMessage="No tracked time for this week."
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
            emptyMessage="No tracked time for this week."
            highlightMax
            kicker="Weekday tracked time"
            title={dailyChartTitle}
          />
          <HourOfDayChart
            data={weekHourOfDayData}
            emptyMessage={
              filters.showAllTrackedTime
                ? "No tracked time for this week."
                : "No productive time for this week."
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
    </>
  );

  const monthStatsContent = (
    <>
      <StatsSection kicker="Overview" title="Overview">
        <StatsKpiGrid items={kpis} />
        {!hasProductiveTime ? (
          <div className="empty-state stats-empty-state">
            No productive time for this month.
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
            emptyMessage="No tracked time for this month."
            kicker="Tracked categories"
            title="Hours by category"
          />
        </div>
      </StatsSection>

      <StatsSection kicker="Trends" title="Trends">
        <div className="stats-section-grid monthly-trend-grid">
          <DailyPlannedHoursChart
            className="monthly-week-chart"
            compact
            data={monthWeeklyProductiveHoursData}
            emptyMessage="No tracked time for this month."
            kicker="Monthly trend"
            showInsights={false}
            title="Tracked time by week"
          />
          <SleepByDayChart data={monthSleepByDayData} />
          <PressureLevelChart
            ariaLabel="Month pressure index by day"
            data={monthPressureData}
            emptyMessage="No task pressure data for this month."
            xAxisMode="date"
          />
        </div>
      </StatsSection>

      <StatsSection kicker="Daily rhythm" title="Daily rhythm">
        <div className="stats-section-grid monthly-rhythm-grid">
          <MonthActivityMap days={monthActivityDays} />
          <HourOfDayChart
            data={monthHourOfDayData}
            emptyMessage="No productive time for this month."
            metricLabel="productive"
            summaries={monthTimeOfDaySummary}
            title="Productive time by hour of day"
          />
        </div>
      </StatsSection>
    </>
  );

  const yearStatsContent = (
    <>
      <StatsSection kicker="Overview" title="Overview">
        <StatsKpiGrid items={kpis} />
      </StatsSection>

      {!hasPeriodData ? (
        <div className="empty-state stats-empty-state">
          No tracked time or due tasks for this year.
        </div>
      ) : null}

      <StatsSection kicker="Time breakdown" title="Time breakdown">
        <div className="stats-section-grid time-breakdown-grid">
          <TimeGroupsSummary
            emptyMessage="No tracked time for this year."
            groups={yearTimeGroups}
            metricLabel="Tracked Time"
          />
          <CategoryHoursChart
            data={categoryChartData}
            emptyMessage="No tracked time for this year."
            kicker="Tracked categories"
            title={categoryChartTitle}
          />
        </div>
      </StatsSection>

      <StatsSection kicker="Rhythm" title="Rhythm">
        <div className="stats-section-grid yearly-rhythm-grid">
          <SleepByDayChart
            ariaLabel="Average sleep hours by month"
            data={yearSleepByMonthData}
            emptyMessage="No sleep logged for this year."
            kicker="Sleep rhythm"
            pointLabelPrefix="Month"
            title="Avg sleep by month"
          />
          <HourOfDayChart
            data={yearHourOfDayData}
            emptyMessage="No productive time for this year."
            metricLabel="productive"
            summaries={yearTimeOfDaySummary}
            title="Productive time by hour of day"
          />
        </div>
      </StatsSection>

      <div className="stats-grid">
        <DailyPlannedHoursChart
          className="year-monthly-productive-chart"
          data={dailyChartData}
          emptyMessage="No tracked time for this year."
          kicker="Monthly trend"
          showInsights={false}
          title={dailyChartTitle}
        />
        <PressureLevelChart
          ariaLabel="Year pressure index by day"
          data={yearPressureData}
          emptyMessage="No task pressure data for this year."
        />
        <YearHeatmap
          data={heatmapData}
          metric={filters.heatmapMetric}
          onPreviewDate={setPreviewStatsDate}
          onSelectDate={onSelectStatsDate}
          selectedDate={selectedStatsDate}
          year={range.start.getFullYear()}
        >
          <SelectedDayStats
            day={visibleHeatmapDay}
            mode={previewHeatmapDay ? "preview" : "selected"}
          />
        </YearHeatmap>
        <YearSummaryPanel
          averageSleepHours={yearCoverageSleepStats?.averageHoursPerDay ?? 0}
          highestProductiveDay={
            highestProductiveDay && highestProductiveDay.hours > 0
              ? {
                  hours: highestProductiveDay.hours,
                  label: highestProductiveDay.label,
                }
              : null
          }
          mostProductiveMonth={
            mostProductiveMonth && mostProductiveMonth.hours > 0
              ? {
                  hours: mostProductiveMonth.hours,
                  label: mostProductiveMonth.label,
                }
              : null
          }
          productiveDays={yearProductiveDays}
          sleepDaysLogged={yearCoverageSleepStats?.daysLogged ?? 0}
          topProductiveGroup={
            topProductiveGroup && topProductiveGroup.hours > 0
              ? {
                  hours: topProductiveGroup.hours,
                  name: topProductiveGroup.name,
                }
              : null
          }
          topTrackedCategory={
            topTrackedCategory
              ? {
                  hours: topTrackedCategory.hours,
                  name: topTrackedCategory.categoryName,
                }
              : null
          }
          trackedDays={yearTrackedDays}
        />
      </div>
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
                : "Productive time uses productive Stats Groups. Tracked time includes active sleep, meal, and rest blocks; abandoned time stays separate."}
          </p>
        </div>
      </section>

      {filters.range === "week" ? (
        weekStatsContent
      ) : filters.range === "month" ? (
        monthStatsContent
      ) : (
        yearStatsContent
      )}
    </div>
  );
}

export default StatsView;
