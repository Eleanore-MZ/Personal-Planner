import type {
  AppSettings,
  StatsBlockKindFilter,
  StatsBlockOutcomeFilter,
  StatsBlockSourceFilter,
  StatsHeatmapMetric,
  StatsRange,
  StatsTimeMode,
} from "../types/app";
import type { Category, StatsGroup, Task, TimeBlock } from "../types/domain";
import {
  addCalendarDays,
  addCalendarMonths,
  getBlocksForDay,
  getCategoryColorValues,
  isAllDayBlock,
  isSameCalendarDay,
  startOfDay,
  startOfWeek,
} from "./calendar";
import { isTaskComplete } from "./tasks";

export type StatsDateRange = {
  start: Date;
  end: Date;
  label: string;
};

export type CategoryHoursDatum = {
  categoryId: string | null;
  categoryName: string;
  color: string;
  hours: number;
  detail?: string;
};

export type DailyHoursDatum = {
  date: string;
  label: string;
  hours: number;
};

export type TaskStatusStats = {
  notStarted: number;
  inProgress: number;
  blocked: number;
  done: number;
  canceled: number;
  overdue: number;
};

export type TimeGroupId =
  string;

export type TimeGroupDatum = {
  id: TimeGroupId;
  name: string;
  color: string;
  countsTowardProductiveTime: boolean;
  hours: number;
  percent: number;
};

export type HourOfDayDatum = {
  hour: number;
  label: string;
  hours: number;
};

export type TimeOfDayDatum = {
  id: "night" | "morning" | "afternoon" | "evening";
  name: string;
  label: string;
  hours: number;
  percent: number;
};

export type WeekRhythmSegment = {
  startMinute: number;
  endMinute: number;
  intensity: number;
};

export type WeekRhythmDay = {
  date: string;
  label: string;
  segments: WeekRhythmSegment[];
};

export type StatsSummary = {
  activeHours: number;
  activeDaysCount: number;
  abandonedHours: number;
  busiestDay: DailyHoursDatum | null;
  pomodoroHours: number;
  totalPlannedHours: number;
  selectedTimeHours: number;
  completedTasks: number;
  dueTasks: number;
  overdueTasks: number;
  timeBlocksCount: number;
  averageSelectedHoursPerDay: number;
  averageSelectedHoursPerWeek: number;
  averagePlannedHoursPerDay: number;
  averagePlannedHoursPerWeek: number;
  mostActiveCategoryName: string | null;
};

export type YearHeatmapDay = {
  date: string;
  activeHours: number;
  abandonedHours: number;
  pomodoroHours: number;
  completedTasks: number;
  dueTasks: number;
  overdueTasks: number;
  timeBlocksCount: number;
  topCategoryName: string | null;
};

export type YearTotals = {
  createdTasks: number;
  completedTasks: number;
  overdueTasks: number;
  timeBlocksCount: number;
  totalPlannedHours: number;
  studyHours: number;
  classHours: number;
  restHours: number;
};

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
});

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const shortMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
});

const rangeDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const rhythmWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

const oneDayMs = 24 * 60 * 60 * 1000;

const isCanceled = (task: Task) => task.status === "canceled";
const isActiveBlock = (block: TimeBlock) => block.outcome === "active";
const isAbandonedBlock = (block: TimeBlock) => block.outcome === "abandoned";
const isPomodoroBlock = (block: TimeBlock) => block.source === "pomodoro";
const isActivePomodoroBlock = (block: TimeBlock) =>
  isActiveBlock(block) && isPomodoroBlock(block);

export function getTimeModeLabel(timeMode?: StatsTimeMode) {
  void timeMode;
  return "Normal";
}

export function getTimeBlocksForTimeMode(
  timeBlocks: TimeBlock[],
  timeMode?: StatsTimeMode,
) {
  void timeMode;
  return timeBlocks.filter(isActiveBlock);
}

function getHoursForBlocks(timeBlocks: TimeBlock[]) {
  return (
    timeBlocks.reduce((total, block) => total + getTimeBlockMinutes(block), 0) /
    60
  );
}

export function getTimeBlockMinutes(block: TimeBlock) {
  if (isAllDayBlock(block)) {
    return 0;
  }

  const startsAt = new Date(block.startsAt).getTime();
  const endsAt = new Date(block.endsAt).getTime();
  return Math.max((endsAt - startsAt) / 60000, 0);
}

function getOverlappingMinutes(block: TimeBlock, start: Date, end: Date) {
  if (isAllDayBlock(block)) {
    return 0;
  }

  const startsAt = new Date(block.startsAt).getTime();
  const endsAt = new Date(block.endsAt).getTime();
  const overlapStart = Math.max(startsAt, start.getTime());
  const overlapEnd = Math.min(endsAt, end.getTime());
  return Math.max((overlapEnd - overlapStart) / 60000, 0);
}

export function getStatsRange(
  mode: StatsRange,
  selectedDate: Date,
  weekStartDay: AppSettings["weekStartDay"] = "monday",
): StatsDateRange {
  if (mode === "year") {
    const start = new Date(selectedDate.getFullYear(), 0, 1);
    const end = new Date(selectedDate.getFullYear() + 1, 0, 1);
    return {
      start,
      end,
      label: `${selectedDate.getFullYear()}`,
    };
  }

  if (mode === "month") {
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
    return {
      start,
      end,
      label: monthLabelFormatter.format(start),
    };
  }

  const start = startOfWeek(selectedDate, weekStartDay);
  const end = addCalendarDays(start, 7);
  const lastDay = addCalendarDays(end, -1);
  return {
    start,
    end,
    label: `${rangeDateFormatter.format(start)} - ${rangeDateFormatter.format(
      lastDay,
    )}`,
  };
}

export function getPreviousPeriodDate(mode: StatsRange, selectedDate: Date) {
  if (mode === "year") {
    return new Date(selectedDate.getFullYear() - 1, selectedDate.getMonth(), 1);
  }

  if (mode === "month") {
    return addCalendarMonths(selectedDate, -1);
  }

  return addCalendarDays(selectedDate, -7);
}

export function getNextPeriodDate(mode: StatsRange, selectedDate: Date) {
  if (mode === "year") {
    return new Date(selectedDate.getFullYear() + 1, selectedDate.getMonth(), 1);
  }

  if (mode === "month") {
    return addCalendarMonths(selectedDate, 1);
  }

  return addCalendarDays(selectedDate, 7);
}

export function getCurrentPeriodDate() {
  return new Date();
}

export function getTimeBlocksInRange(
  timeBlocks: TimeBlock[],
  start: Date,
  end: Date,
) {
  return timeBlocks.filter((block) => {
    const startsAt = new Date(block.startsAt).getTime();
    const endsAt = new Date(block.endsAt).getTime();
    return endsAt > start.getTime() && startsAt < end.getTime();
  });
}

export function getTasksDueInRange(tasks: Task[], start: Date, end: Date) {
  return tasks.filter((task) => {
    if (!task.dueDate || isCanceled(task)) {
      return false;
    }

    const dueDate = startOfDay(new Date(task.dueDate)).getTime();
    return dueDate >= start.getTime() && dueDate < end.getTime();
  });
}

export function getTasksCompletedInRange(tasks: Task[], start: Date, end: Date) {
  return getTasksDueInRange(tasks, start, end).filter(isTaskComplete);
}

export function getOverdueTasks(tasks: Task[], referenceDate = new Date()) {
  const referenceDay = startOfDay(referenceDate).getTime();
  return tasks.filter((task) => {
    if (!task.dueDate || isTaskComplete(task) || isCanceled(task)) {
      return false;
    }

    return startOfDay(new Date(task.dueDate)).getTime() < referenceDay;
  });
}

export function calculateTotalPlannedHours(timeBlocks: TimeBlock[]) {
  return getHoursForBlocks(timeBlocks.filter(isActiveBlock));
}

export function calculateActualHours(timeBlocks: TimeBlock[]) {
  return getHoursForBlocks(timeBlocks.filter(isActiveBlock));
}

export function calculateSkippedHours(timeBlocks: TimeBlock[]) {
  return getHoursForBlocks(timeBlocks.filter(isAbandonedBlock));
}

export function calculatePomodoroHours(timeBlocks: TimeBlock[]) {
  return getHoursForBlocks(timeBlocks.filter(isActivePomodoroBlock));
}

export function calculateCategoryHours(
  timeBlocks: TimeBlock[],
  categories: Category[],
  timeMode: StatsTimeMode = "active",
) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const hoursByCategory = new Map<string | null, number>();

  getTimeBlocksForTimeMode(timeBlocks, timeMode).forEach((block) => {
    const categoryId = categoryById.has(block.categoryId) ? block.categoryId : null;
    hoursByCategory.set(
      categoryId,
      (hoursByCategory.get(categoryId) ?? 0) + getTimeBlockMinutes(block) / 60,
    );
  });

  categories.forEach((category) => {
    if (!hoursByCategory.has(category.id)) {
      hoursByCategory.set(category.id, 0);
    }
  });

  return Array.from(hoursByCategory.entries())
    .map<CategoryHoursDatum>(([categoryId, hours]) => {
      const category = categoryId ? categoryById.get(categoryId) : undefined;
      const colors = getCategoryColorValues(category?.color);
      return {
        categoryId,
        categoryName: category?.name ?? "Uncategorized",
        color: colors.accent,
        hours,
      };
    })
    .sort((first, second) => second.hours - first.hours);
}

const kindLabels: Record<TimeBlock["kind"], string> = {
  event: "Event",
  "task-session": "Task session",
  habit: "Habit",
  routine: "Routine",
};

const outcomeLabels: Record<TimeBlock["outcome"], string> = {
  active: "Normal",
  abandoned: "Abandoned",
};

const sourceLabels: Record<TimeBlock["source"], string> = {
  manual: "Manual",
  pomodoro: "Pomodoro",
  generated: "Generated",
  imported: "Imported",
};

const dimensionColors = [
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#f59e0b",
  "#f87171",
  "#60a5fa",
];

const otherTimeGroupDefinition = {
  id: "other",
  name: "Other",
  color: "#94a3b8",
  countsTowardProductiveTime: true,
} satisfies Pick<
  TimeGroupDatum,
  "id" | "name" | "color" | "countsTowardProductiveTime"
>;

const timeOfDayDefinitions: Array<{
  id: TimeOfDayDatum["id"];
  name: string;
  label: string;
  startHour: number;
  endHour: number;
}> = [
  { id: "night", name: "Night", label: "00:00-06:00", startHour: 0, endHour: 6 },
  {
    id: "morning",
    name: "Morning",
    label: "06:00-12:00",
    startHour: 6,
    endHour: 12,
  },
  {
    id: "afternoon",
    name: "Afternoon",
    label: "12:00-18:00",
    startHour: 12,
    endHour: 18,
  },
  {
    id: "evening",
    name: "Evening",
    label: "18:00-24:00",
    startHour: 18,
    endHour: 24,
  },
];

function createDimensionDatum(
  key: string | null,
  label: string,
  hours: number,
  index: number,
  detail?: string,
): CategoryHoursDatum {
  return {
    categoryId: key,
    categoryName: label,
    color: dimensionColors[index % dimensionColors.length],
    hours,
    detail,
  };
}

export function calculateDimensionHours(
  timeBlocks: TimeBlock[],
  categories: Category[],
  analyzeBy: "category" | "kind" | "outcome" | "source",
) {
  if (analyzeBy === "category") {
    return calculateCategoryHours(timeBlocks, categories);
  }

  const hoursByDimension = new Map<string, number>();
  timeBlocks.forEach((block) => {
    const key = block[analyzeBy];
    hoursByDimension.set(
      key,
      (hoursByDimension.get(key) ?? 0) + getTimeBlockMinutes(block) / 60,
    );
  });

  const labels =
    analyzeBy === "kind"
      ? kindLabels
      : analyzeBy === "outcome"
        ? outcomeLabels
        : sourceLabels;

  return Object.entries(labels)
    .map(([key, label], index) =>
      createDimensionDatum(
        key,
        label,
        hoursByDimension.get(key) ?? 0,
        index,
        analyzeBy,
      ),
    )
    .sort((first, second) => second.hours - first.hours);
}

export function calculateTimeGroupHours(
  timeBlocks: TimeBlock[],
  categories: Category[],
  statsGroups: StatsGroup[],
) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const groupByCategoryId = new Map<string, StatsGroup>();
  const sortedGroups = [...statsGroups].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );
  const hoursByGroup = new Map<TimeGroupId, number>();
  const otherGroup =
    sortedGroups.find((group) => group.name.toLowerCase() === "other") ??
    otherTimeGroupDefinition;
  const groupDefinitions = [
    ...sortedGroups.map((group) => ({
      id: group.id,
      name: group.name,
      color: group.color,
      countsTowardProductiveTime: group.countsTowardProductiveTime,
    })),
    ...(sortedGroups.some((group) => group.id === otherGroup.id)
      ? []
      : [otherGroup]),
  ];

  groupDefinitions.forEach((definition) => {
    hoursByGroup.set(definition.id, 0);
  });
  sortedGroups.forEach((group) => {
    group.categoryIds.forEach((categoryId) => {
      groupByCategoryId.set(categoryId, group);
    });
  });

  getTimeBlocksForTimeMode(timeBlocks, "active").forEach((block) => {
    const category = categoryById.get(block.categoryId);
    const group = category ? groupByCategoryId.get(category.id) : undefined;
    const groupId = group?.id ?? otherGroup.id;
    hoursByGroup.set(
      groupId,
      (hoursByGroup.get(groupId) ?? 0) + getTimeBlockMinutes(block) / 60,
    );
  });

  const totalHours = Array.from(hoursByGroup.values()).reduce(
    (total, hours) => total + hours,
    0,
  );

  return groupDefinitions.map<TimeGroupDatum>((definition) => {
    const hours = hoursByGroup.get(definition.id) ?? 0;
    return {
      id: definition.id,
      name: definition.name,
      color: definition.color,
      countsTowardProductiveTime: definition.countsTowardProductiveTime,
      hours,
      percent: totalHours > 0 ? (hours / totalHours) * 100 : 0,
    };
  });
}

export function filterBlocksByStatsGroupProductiveTime(
  timeBlocks: TimeBlock[],
  categories: Category[],
  statsGroups: StatsGroup[],
) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const groupByCategoryId = new Map<string, StatsGroup>();

  statsGroups.forEach((group) => {
    group.categoryIds.forEach((categoryId) => {
      groupByCategoryId.set(categoryId, group);
    });
  });

  return timeBlocks.filter((block) => {
    const category = categoryById.get(block.categoryId);
    const group = category ? groupByCategoryId.get(category.id) : undefined;
    return group?.countsTowardProductiveTime ?? true;
  });
}

function formatHourLabel(hour: number) {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function getNextHourStart(date: Date) {
  const nextHour = new Date(date);
  nextHour.setMinutes(0, 0, 0);

  if (nextHour.getTime() <= date.getTime()) {
    nextHour.setHours(nextHour.getHours() + 1);
  }

  return nextHour;
}

export function calculateHourOfDayActivity(
  timeBlocks: TimeBlock[],
  start: Date,
  end: Date,
) {
  const minutesByHour = Array.from({ length: 24 }, () => 0);

  getTimeBlocksForTimeMode(timeBlocks, "active").forEach((block) => {
    if (isAllDayBlock(block)) {
      return;
    }

    let cursor = new Date(
      Math.max(new Date(block.startsAt).getTime(), start.getTime()),
    );
    const blockEnd = new Date(
      Math.min(new Date(block.endsAt).getTime(), end.getTime()),
    );

    while (cursor.getTime() < blockEnd.getTime()) {
      const nextBoundary = getNextHourStart(cursor);
      const segmentEnd = new Date(
        Math.min(nextBoundary.getTime(), blockEnd.getTime()),
      );
      const minutes = Math.max(
        (segmentEnd.getTime() - cursor.getTime()) / 60000,
        0,
      );

      minutesByHour[cursor.getHours()] += minutes;
      cursor = segmentEnd;
    }
  });

  return minutesByHour.map<HourOfDayDatum>((minutes, hour) => ({
    hour,
    label: formatHourLabel(hour),
    hours: minutes / 60,
  }));
}

export function calculateTimeOfDaySummary(hourData: HourOfDayDatum[]) {
  const totalHours = hourData.reduce((total, hour) => total + hour.hours, 0);

  return timeOfDayDefinitions.map<TimeOfDayDatum>((definition) => {
    const hours = hourData
      .slice(definition.startHour, definition.endHour)
      .reduce((total, hour) => total + hour.hours, 0);

    return {
      id: definition.id,
      name: definition.name,
      label: definition.label,
      hours,
      percent: totalHours > 0 ? (hours / totalHours) * 100 : 0,
    };
  });
}

export function calculateWeekRhythm(
  timeBlocks: TimeBlock[],
  start: Date,
): WeekRhythmDay[] {
  const activeBlocks = getTimeBlocksForTimeMode(timeBlocks, "active").filter(
    (block) => !isAllDayBlock(block),
  );

  return Array.from({ length: 7 }, (_, dayIndex) => {
    const dayStart = addCalendarDays(start, dayIndex);
    const dayEnd = addCalendarDays(dayStart, 1);
    const events: Array<{ minute: number; delta: number }> = [];

    activeBlocks.forEach((block) => {
      const blockStart = new Date(block.startsAt).getTime();
      const blockEnd = new Date(block.endsAt).getTime();
      const overlapStart = Math.max(blockStart, dayStart.getTime());
      const overlapEnd = Math.min(blockEnd, dayEnd.getTime());

      if (overlapEnd <= overlapStart) {
        return;
      }

      events.push({
        minute: Math.max((overlapStart - dayStart.getTime()) / 60000, 0),
        delta: 1,
      });
      events.push({
        minute: Math.min((overlapEnd - dayStart.getTime()) / 60000, 24 * 60),
        delta: -1,
      });
    });

    events.sort((first, second) => first.minute - second.minute);

    const segments: WeekRhythmSegment[] = [];
    let activeCount = 0;
    let currentMinute = 0;
    let eventIndex = 0;

    while (eventIndex < events.length) {
      const minute = events[eventIndex].minute;

      if (activeCount > 0 && minute > currentMinute) {
        segments.push({
          startMinute: currentMinute,
          endMinute: minute,
          intensity: activeCount,
        });
      }

      while (
        eventIndex < events.length &&
        events[eventIndex].minute === minute
      ) {
        activeCount += events[eventIndex].delta;
        eventIndex += 1;
      }

      currentMinute = minute;
    }

    return {
      date: dayStart.toISOString(),
      label: rhythmWeekdayFormatter.format(dayStart),
      segments,
    };
  });
}

export function calculateDailyPlannedHours(
  timeBlocks: TimeBlock[],
  start: Date,
  end: Date,
  timeMode: StatsTimeMode = "active",
): DailyHoursDatum[] {
  const selectedBlocks = getTimeBlocksForTimeMode(timeBlocks, timeMode);
  const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / oneDayMs));
  return Array.from({ length: dayCount }, (_, index) => {
    const dayStart = addCalendarDays(start, index);
    const dayEnd = addCalendarDays(dayStart, 1);
    const minutes = selectedBlocks.reduce(
      (total, block) => total + getOverlappingMinutes(block, dayStart, dayEnd),
      0,
    );

    return {
      date: dayStart.toISOString(),
      label: dayCount > 31 ? shortMonthFormatter.format(dayStart) : dayLabelFormatter.format(dayStart),
      hours: minutes / 60,
    };
  });
}

export function calculateMonthlyPlannedHours(
  timeBlocks: TimeBlock[],
  year: number,
  timeMode: StatsTimeMode = "active",
) {
  const selectedBlocks = getTimeBlocksForTimeMode(timeBlocks, timeMode);
  return Array.from({ length: 12 }, (_, month) => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    const minutes = selectedBlocks.reduce(
      (total, block) => total + getOverlappingMinutes(block, start, end),
      0,
    );
    return {
      date: start.toISOString(),
      label: shortMonthFormatter.format(start),
      hours: minutes / 60,
    };
  });
}

export function calculateTaskStatusStats(
  tasks: Task[],
  _start: Date,
  _end: Date,
  referenceDate = new Date(),
): TaskStatusStats {
  return {
    notStarted: tasks.filter((task) => task.status === "todo").length,
    inProgress: tasks.filter((task) => task.status === "in-progress").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    done: tasks.filter((task) => task.status === "done").length,
    canceled: tasks.filter((task) => task.status === "canceled").length,
    overdue: getOverdueTasks(tasks, referenceDate).length,
  };
}

export function calculateStatsSummary(
  tasks: Task[],
  timeBlocks: TimeBlock[],
  categories: Category[],
  start: Date,
  end: Date,
  timeMode: StatsTimeMode = "active",
  referenceDate = new Date(),
): StatsSummary {
  const categoryHours = calculateCategoryHours(timeBlocks, categories, timeMode);
  const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / oneDayMs));
  const weekCount = Math.max(1, dayCount / 7);
  const activeDailyHours = calculateDailyPlannedHours(
    timeBlocks,
    start,
    end,
    "active",
  );
  const busiestDay =
    activeDailyHours.reduce<DailyHoursDatum | null>((currentBusiestDay, day) => {
      if (!currentBusiestDay || day.hours > currentBusiestDay.hours) {
        return day;
      }

      return currentBusiestDay;
    }, null) ?? null;
  const activeHours = calculateActualHours(timeBlocks);
  const abandonedHours = calculateSkippedHours(timeBlocks);
  const pomodoroHours = calculatePomodoroHours(timeBlocks);
  const selectedTimeHours = getHoursForBlocks(
    getTimeBlocksForTimeMode(timeBlocks, timeMode),
  );
  const totalPlannedHours = calculateTotalPlannedHours(timeBlocks);

  return {
    activeHours,
    activeDaysCount: activeDailyHours.filter((day) => day.hours > 0).length,
    abandonedHours,
    busiestDay: busiestDay && busiestDay.hours > 0 ? busiestDay : null,
    pomodoroHours,
    totalPlannedHours,
    selectedTimeHours,
    completedTasks: getTasksCompletedInRange(tasks, start, end).length,
    dueTasks: getTasksDueInRange(tasks, start, end).length,
    overdueTasks: getOverdueTasks(tasks, referenceDate).length,
    timeBlocksCount: getTimeBlocksForTimeMode(timeBlocks, timeMode).length,
    averageSelectedHoursPerDay: selectedTimeHours / dayCount,
    averageSelectedHoursPerWeek: selectedTimeHours / weekCount,
    averagePlannedHoursPerDay: totalPlannedHours / dayCount,
    averagePlannedHoursPerWeek: totalPlannedHours / weekCount,
    mostActiveCategoryName:
      categoryHours.find((category) => category.hours > 0)?.categoryName ?? null,
  };
}

export function buildYearHeatmapData(
  tasks: Task[],
  timeBlocks: TimeBlock[],
  categories: Category[],
  year: number,
) {
  const days: YearHeatmapDay[] = [];
  const date = new Date(year, 0, 1);

  while (date.getFullYear() === year) {
    const dayStart = startOfDay(date);
    const dayEnd = addCalendarDays(dayStart, 1);
    const dayBlocks = getBlocksForDay(timeBlocks, dayStart);
    const dueTasks = getTasksDueInRange(tasks, dayStart, dayEnd);
    const categoryHours = calculateCategoryHours(dayBlocks, categories);

    days.push({
      date: dayStart.toISOString(),
      activeHours: calculateActualHours(dayBlocks),
      abandonedHours: calculateSkippedHours(dayBlocks),
      pomodoroHours: calculatePomodoroHours(dayBlocks),
      completedTasks: dueTasks.filter(isTaskComplete).length,
      dueTasks: dueTasks.length,
      overdueTasks: getOverdueTasks(dueTasks, dayEnd).length,
      timeBlocksCount: dayBlocks.length,
      topCategoryName:
        categoryHours.find((category) => category.hours > 0)?.categoryName ??
        null,
    });

    date.setDate(date.getDate() + 1);
  }

  return days;
}

export function getHeatmapValue(
  day: YearHeatmapDay,
  metric: StatsHeatmapMetric,
) {
  if (metric === "active_hours") {
    return day.activeHours;
  }

  if (metric === "abandoned_hours") {
    return day.abandonedHours;
  }

  if (metric === "pomodoro_hours") {
    return day.pomodoroHours;
  }

  if (metric === "completed_tasks") {
    return day.completedTasks;
  }

  if (metric === "due_tasks") {
    return day.dueTasks;
  }

  if (metric === "overdue_tasks") {
    return day.overdueTasks;
  }

  return day.timeBlocksCount;
}

export function getHeatmapIntensity(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil((value / maxValue) * 4));
}

export function filterStatsTasks(
  tasks: Task[],
  categoryId: string,
  includeCompletedTasks: boolean,
  includeUncategorized: boolean,
  categories: Category[],
  includeStatsExcludedCategories = false,
) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  return tasks.filter((task) => {
    const category = categoryById.get(task.categoryId);
    const taskIsUncategorized = !category;
    const categoryIncluded =
      includeStatsExcludedCategories ||
      taskIsUncategorized ||
      Boolean(category?.includeInStatsByDefault);
    const matchesCategory =
      categoryId === "all"
        ? (includeUncategorized || !taskIsUncategorized) &&
          categoryIncluded
        : task.categoryId === categoryId && categoryIncluded;
    const matchesCompletion = includeCompletedTasks || !isTaskComplete(task);
    return matchesCategory && matchesCompletion;
  });
}

export function filterStatsTimeBlocks(
  timeBlocks: TimeBlock[],
  categoryId: string,
  includeAllDayBlocks: boolean,
  includeUncategorized: boolean,
  categories: Category[],
  includeStatsExcludedCategories = false,
  blockKind: StatsBlockKindFilter = "all",
  blockOutcome: StatsBlockOutcomeFilter = "all",
  blockSource: StatsBlockSourceFilter = "all",
) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  return timeBlocks.filter((block) => {
    if (!includeAllDayBlocks && isAllDayBlock(block)) {
      return false;
    }

    if (blockKind !== "all" && block.kind !== blockKind) {
      return false;
    }

    if (blockOutcome !== "all" && block.outcome !== blockOutcome) {
      return false;
    }

    if (blockSource !== "all" && block.source !== blockSource) {
      return false;
    }

    const category = categoryById.get(block.categoryId);
    const blockIsUncategorized = !category;
    const categoryIncluded =
      includeStatsExcludedCategories ||
      blockIsUncategorized ||
      Boolean(category?.includeInStatsByDefault);

    if (categoryId !== "all") {
      return block.categoryId === categoryId && categoryIncluded;
    }

    return (
      (includeUncategorized || !blockIsUncategorized) &&
      categoryIncluded
    );
  });
}

export function getSelectedHeatmapDay(
  heatmapData: YearHeatmapDay[],
  selectedDate: Date,
) {
  return heatmapData.find((day) =>
    isSameCalendarDay(new Date(day.date), selectedDate),
  );
}
