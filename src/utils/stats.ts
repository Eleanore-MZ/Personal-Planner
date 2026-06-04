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
import { DateTime } from "luxon";
import {
  getZonedDayBoundary,
  systemTimeZone,
  toZonedCalendarDate,
} from "./timezone";

export type StatsDateRange = {
  start: Date;
  end: Date;
  label: string;
};

export type YearStatsCoverageWindow = {
  dayCount: number;
  end: Date;
  start: Date;
  weekCount: number;
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

export type DailyGroupHoursSegment = {
  groupId: string;
  groupName: string;
  color: string;
  hours: number;
};

export type DailyGroupHoursDatum = DailyHoursDatum & {
  segments: DailyGroupHoursSegment[];
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
  color: string;
  groupName: string;
  lane: number;
  tooltip: string;
};

export type WeekRhythmDay = {
  date: string;
  label: string;
  laneCount: number;
  segments: WeekRhythmSegment[];
};

export type PressureDatum = {
  date: string;
  label: string;
  rawPressure: number | null;
  smoothedPressure: number | null;
  duePressure: number;
  duePoints: number;
  examMarkerColor: string | null;
  examPressure: number;
  examsOnDayCount: number;
  examsWithin3DaysCount: number;
  tasksDueWithin3DaysCount: number;
  taskWorkHours: number;
  workPoints: number;
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

export type SleepStats = {
  averageHoursPerDay: number;
  averageDayCount: number;
  daysLogged: number;
  longestDay: DailyHoursDatum | null;
  shortestDay: DailyHoursDatum | null;
  totalHours: number;
};

export type SleepAveragePolicy = "logged-days" | "period-days";

export type YearHeatmapDay = {
  date: string;
  productiveHours: number;
  trackedHours: number;
  sleepHours: number;
  abandonedHours: number;
  focusHours: number;
  timeBlocksCount: number;
  topStatsGroupName: string | null;
  topCategoryName: string | null;
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
const getBoundaryInstant = (date: Date, timeZone?: string) =>
  timeZone ? getZonedDayBoundary(date, timeZone) : date;
const getCalendarDayIndex = (start: Date, date: Date) =>
  Math.round(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      oneDayMs,
  );
const getCalendarDayCount = (start: Date, end: Date) =>
  Math.max(1, getCalendarDayIndex(start, end));

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

function getOverlappingMinutesForInstants(
  block: TimeBlock,
  startMs: number,
  endMs: number,
) {
  if (isAllDayBlock(block)) {
    return 0;
  }

  const startsAt = new Date(block.startsAt).getTime();
  const endsAt = new Date(block.endsAt).getTime();
  const overlapStart = Math.max(startsAt, startMs);
  const overlapEnd = Math.min(endsAt, endMs);
  return Math.max((overlapEnd - overlapStart) / 60000, 0);
}

export function getOverlappingMinutes(
  block: TimeBlock,
  start: Date,
  end: Date,
  timeZone?: string,
) {
  return getOverlappingMinutesForInstants(
    block,
    getBoundaryInstant(start, timeZone).getTime(),
    getBoundaryInstant(end, timeZone).getTime(),
  );
}

function getCategoryStatsGroup(
  categoryId: string,
  categories: Category[],
  statsGroups: StatsGroup[],
) {
  const category = categories.find((currentCategory) => currentCategory.id === categoryId);
  const group = category
    ? statsGroups.find((currentGroup) =>
        currentGroup.categoryIds.includes(category.id),
      )
    : undefined;

  return { category, group };
}

function isSleepStatsCategory(category?: Category, group?: StatsGroup) {
  const categoryName = category?.name.trim().toLowerCase() ?? "";
  const groupName = group?.name.trim().toLowerCase() ?? "";
  const categoryLooksLikeSleep = categoryName.includes("sleep");
  const isSleepGroup = groupName.includes("sleep");

  return categoryLooksLikeSleep || (isSleepGroup && categoryLooksLikeSleep);
}

function getSleepAverageDayCount(
  start: Date,
  end: Date,
  dayCount: number,
  daysLogged: number,
  averagePolicy: SleepAveragePolicy,
  recordedDayCount?: number,
  currentDate = new Date(),
) {
  if (recordedDayCount !== undefined) {
    return recordedDayCount;
  }

  const rangeStart = startOfDay(start).getTime();
  const rangeEnd = end.getTime();
  const todayStart = startOfDay(currentDate).getTime();

  if (todayStart >= rangeStart && todayStart < rangeEnd) {
    const elapsedDays = Math.floor((todayStart - rangeStart) / oneDayMs) + 1;
    return Math.max(1, Math.min(dayCount, elapsedDays));
  }

  if (averagePolicy === "period-days") {
    return dayCount;
  }

  return Math.max(1, daysLogged || dayCount);
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

export function getCurrentPeriodDate(timeZone?: string) {
  return timeZone ? toZonedCalendarDate(new Date(), timeZone) : new Date();
}

export function getTimeBlocksInRange(
  timeBlocks: TimeBlock[],
  start: Date,
  end: Date,
  timeZone?: string,
) {
  const rangeStart = getBoundaryInstant(start, timeZone).getTime();
  const rangeEnd = getBoundaryInstant(end, timeZone).getTime();
  return timeBlocks.filter((block) => {
    const startsAt = new Date(block.startsAt).getTime();
    const endsAt = new Date(block.endsAt).getTime();
    return endsAt > rangeStart && startsAt < rangeEnd;
  });
}

export function getRecordedTimeBlockDayCount(
  timeBlocks: TimeBlock[],
  start: Date,
  end: Date,
  timeZone?: string,
) {
  const recordedDays = new Set<string>();
  const rangeStart = getBoundaryInstant(start, timeZone).getTime();
  const rangeEnd = getBoundaryInstant(end, timeZone).getTime();

  timeBlocks.forEach((block) => {
    const startsAt = new Date(block.startsAt).getTime();
    const endsAt = new Date(block.endsAt).getTime();
    const overlapStart = Math.max(startsAt, rangeStart);
    const overlapEnd = Math.min(endsAt, rangeEnd);

    if (overlapEnd <= overlapStart) {
      return;
    }

    const lastRecordedDay = startOfDay(
      timeZone
        ? toZonedCalendarDate(new Date(overlapEnd - 1), timeZone)
        : new Date(overlapEnd - 1),
    );
    const recordedDay = startOfDay(
      timeZone
        ? toZonedCalendarDate(new Date(overlapStart), timeZone)
        : new Date(overlapStart),
    );

    while (recordedDay.getTime() <= lastRecordedDay.getTime()) {
      recordedDays.add(
        `${recordedDay.getFullYear()}-${recordedDay.getMonth()}-${recordedDay.getDate()}`,
      );
      recordedDay.setDate(recordedDay.getDate() + 1);
    }
  });

  return recordedDays.size;
}

export function getYearStatsCoverageWindow(
  timeBlocks: TimeBlock[],
  year: number,
  currentDate = new Date(),
  timeZone?: string,
): YearStatsCoverageWindow | null {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const yearStartInstant = getBoundaryInstant(yearStart, timeZone);
  const yearEndInstant = getBoundaryInstant(yearEnd, timeZone);
  const meaningfulBlocks = timeBlocks.filter((block) => {
    const startsAt = new Date(block.startsAt).getTime();
    const endsAt = new Date(block.endsAt).getTime();
    return endsAt > yearStartInstant.getTime() && startsAt < yearEndInstant.getTime();
  });

  if (meaningfulBlocks.length === 0) {
    return null;
  }

  const firstBlockTime = Math.min(
    ...meaningfulBlocks.map((block) =>
      Math.max(new Date(block.startsAt).getTime(), yearStartInstant.getTime()),
    ),
  );
  const lastBlockTime = Math.max(
    ...meaningfulBlocks.map((block) =>
      Math.min(new Date(block.endsAt).getTime() - 1, yearEndInstant.getTime() - 1),
    ),
  );
  const coverageStart = startOfDay(
    timeZone
      ? toZonedCalendarDate(new Date(firstBlockTime), timeZone)
      : new Date(firstBlockTime),
  );
  const zonedCurrentDate = timeZone
    ? toZonedCalendarDate(currentDate, timeZone)
    : currentDate;
  const currentYear = zonedCurrentDate.getFullYear();
  const lastBlockDay = startOfDay(
    timeZone
      ? toZonedCalendarDate(new Date(lastBlockTime), timeZone)
      : new Date(lastBlockTime),
  );
  const coverageEnd = startOfDay(
    currentYear === year
      ? new Date(
          Math.min(
            Math.max(
              startOfDay(zonedCurrentDate).getTime(),
              coverageStart.getTime(),
              lastBlockDay.getTime(),
            ),
            yearEnd.getTime() - 1,
          ),
        )
      : lastBlockDay,
  );
  const dayCount = getRecordedTimeBlockDayCount(
    meaningfulBlocks,
    coverageStart,
    addCalendarDays(coverageEnd, 1),
    timeZone,
  );

  return {
    dayCount,
    end: coverageEnd,
    start: coverageStart,
    weekCount: dayCount / 7,
  };
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

export function getOverdueTasks(
  tasks: Task[],
  referenceDate = new Date(),
  timeZone?: string,
) {
  const referenceDay = startOfDay(
    timeZone ? toZonedCalendarDate(referenceDate, timeZone) : referenceDate,
  ).getTime();
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

  const orderedCategoryHours = categories.map<CategoryHoursDatum>((category) => {
    const colors = getCategoryColorValues(category.color);
    return {
      categoryId: category.id,
      categoryName: category.name,
      color: colors.accent,
      hours: hoursByCategory.get(category.id) ?? 0,
    };
  });

  if (hoursByCategory.has(null)) {
    const colors = getCategoryColorValues(undefined);
    orderedCategoryHours.push({
      categoryId: null,
      categoryName: "Uncategorized",
      color: colors.accent,
      hours: hoursByCategory.get(null) ?? 0,
    });
  }

  return orderedCategoryHours;
}

function getTopCategoryHoursDatum(categoryHours: CategoryHoursDatum[]) {
  return categoryHours.reduce<CategoryHoursDatum | null>(
    (topCategory, category) =>
      category.hours > (topCategory?.hours ?? 0) ? category : topCategory,
    null,
  );
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
  timer: "Timer",
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

function formatMinuteLabel(minuteOfDay: number) {
  const roundedMinute = Math.round(minuteOfDay);
  const hour = Math.floor(roundedMinute / 60);
  const minute = roundedMinute % 60;
  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
}

export function calculateHourOfDayActivity(
  timeBlocks: TimeBlock[],
  start: Date,
  end: Date,
  timeZone = systemTimeZone,
) {
  const minutesByHour = Array.from({ length: 24 }, () => 0);
  const rangeStartMs = getBoundaryInstant(start, timeZone).getTime();
  const rangeEndMs = getBoundaryInstant(end, timeZone).getTime();

  getTimeBlocksForTimeMode(timeBlocks, "active").forEach((block) => {
    if (isAllDayBlock(block)) {
      return;
    }

    let cursor = new Date(
      Math.max(
        new Date(block.startsAt).getTime(),
        rangeStartMs,
      ),
    );
    const blockEnd = new Date(
      Math.min(
        new Date(block.endsAt).getTime(),
        rangeEndMs,
      ),
    );

    while (cursor.getTime() < blockEnd.getTime()) {
      const nextBoundary = DateTime.fromJSDate(cursor)
        .setZone(timeZone)
        .startOf("hour")
        .plus({ hours: 1 })
        .toJSDate();
      const segmentEnd = new Date(
        Math.min(nextBoundary.getTime(), blockEnd.getTime()),
      );
      const minutes = Math.max(
        (segmentEnd.getTime() - cursor.getTime()) / 60000,
        0,
      );

      minutesByHour[toZonedCalendarDate(cursor, timeZone).getHours()] += minutes;
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
  categories: Category[],
  statsGroups: StatsGroup[],
  timeZone = systemTimeZone,
): WeekRhythmDay[] {
  const activeBlocks = getTimeBlocksForTimeMode(timeBlocks, "active").filter(
    (block) => !isAllDayBlock(block),
  );
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const otherGroup =
    statsGroups.find((group) => group.name.toLowerCase() === "other") ??
    otherTimeGroupDefinition;
  const groupByCategoryId = new Map<string, StatsGroup>();

  statsGroups.forEach((group) => {
    group.categoryIds.forEach((categoryId) => {
      groupByCategoryId.set(categoryId, group);
    });
  });

  const getGroupForBlock = (block: TimeBlock) => {
    const category = categoryById.get(block.categoryId);
    return category ? groupByCategoryId.get(category.id) ?? otherGroup : otherGroup;
  };

  return Array.from({ length: 7 }, (_, dayIndex) => {
    const dayStart = addCalendarDays(start, dayIndex);
    const dayEnd = addCalendarDays(dayStart, 1);
    const dayStartInstant = getBoundaryInstant(dayStart, timeZone).getTime();
    const dayEndInstant = getBoundaryInstant(dayEnd, timeZone).getTime();
    const intervals = activeBlocks.flatMap((block) => {
      const blockStart = new Date(block.startsAt).getTime();
      const blockEnd = new Date(block.endsAt).getTime();
      const overlapStart = Math.max(blockStart, dayStartInstant);
      const overlapEnd = Math.min(blockEnd, dayEndInstant);

      if (overlapEnd <= overlapStart) {
        return [];
      }

      const category = categoryById.get(block.categoryId);
      const group = getGroupForBlock(block);
      const zonedStart = toZonedCalendarDate(new Date(overlapStart), timeZone);
      const zonedEnd = toZonedCalendarDate(new Date(overlapEnd), timeZone);
      const startMinute = Math.max(
        zonedStart.getHours() * 60 + zonedStart.getMinutes(),
        0,
      );
      const endMinute =
        isSameCalendarDay(zonedStart, zonedEnd)
          ? zonedEnd.getHours() * 60 + zonedEnd.getMinutes()
          : 24 * 60;
      const timeRange = `${formatMinuteLabel(startMinute)}-${formatMinuteLabel(
        endMinute,
      )}`;

      return [
        {
          startMinute,
          endMinute,
          color: group.color,
          groupName: group.name,
          tooltip: `${rhythmWeekdayFormatter.format(dayStart)} ${timeRange}\nGroup: ${
            group.name
          }\nCategory: ${category?.name ?? "Uncategorized"}\nBlock: ${block.title}`,
        },
      ];
    });
    const laneEnds: number[] = [];
    const segments = intervals
      .sort(
        (first, second) =>
          first.startMinute - second.startMinute ||
          first.endMinute - second.endMinute,
      )
      .map<WeekRhythmSegment>((interval) => {
        const lane = laneEnds.findIndex((endMinute) => interval.startMinute >= endMinute);
        const laneIndex = lane >= 0 ? lane : laneEnds.length;
        laneEnds[laneIndex] = interval.endMinute;

        return {
          startMinute: interval.startMinute,
          endMinute: interval.endMinute,
          color: interval.color,
          groupName: interval.groupName,
          lane: laneIndex,
          tooltip: interval.tooltip,
        };
      });

    return {
      date: dayStart.toISOString(),
      label: rhythmWeekdayFormatter.format(dayStart),
      laneCount: Math.max(laneEnds.length, 1),
      segments,
    };
  });
}

export function calculateDailyPlannedHours(
  timeBlocks: TimeBlock[],
  start: Date,
  end: Date,
  timeMode: StatsTimeMode = "active",
  timeZone?: string,
): DailyHoursDatum[] {
  const selectedBlocks = getTimeBlocksForTimeMode(timeBlocks, timeMode);
  const dayCount = getCalendarDayCount(start, end);
  return Array.from({ length: dayCount }, (_, index) => {
    const dayStart = addCalendarDays(start, index);
    const dayEnd = addCalendarDays(dayStart, 1);
    const dayStartMs = getBoundaryInstant(dayStart, timeZone).getTime();
    const dayEndMs = getBoundaryInstant(dayEnd, timeZone).getTime();
    const minutes = selectedBlocks.reduce(
      (total, block) =>
        total + getOverlappingMinutesForInstants(block, dayStartMs, dayEndMs),
      0,
    );

    return {
      date: dayStart.toISOString(),
      label: dayCount > 31 ? shortMonthFormatter.format(dayStart) : dayLabelFormatter.format(dayStart),
      hours: minutes / 60,
    };
  });
}

export function calculateDailyStatsGroupHours(
  timeBlocks: TimeBlock[],
  start: Date,
  end: Date,
  categories: Category[],
  statsGroups: StatsGroup[],
  timeMode: StatsTimeMode = "active",
  timeZone?: string,
): DailyGroupHoursDatum[] {
  const selectedBlocks = getTimeBlocksForTimeMode(timeBlocks, timeMode);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const sortedGroups = [...statsGroups].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );
  const otherGroup =
    sortedGroups.find((group) => group.name.toLowerCase() === "other") ??
    otherTimeGroupDefinition;
  const groupDefinitions = [
    ...sortedGroups.map((group) => ({
      id: group.id,
      name: group.name,
      color: group.color,
    })),
    ...(sortedGroups.some((group) => group.id === otherGroup.id)
      ? []
      : [otherGroup]),
  ];
  const groupByCategoryId = new Map<string, StatsGroup>();

  sortedGroups.forEach((group) => {
    group.categoryIds.forEach((categoryId) => {
      groupByCategoryId.set(categoryId, group);
    });
  });

  const getGroupForBlock = (block: TimeBlock) => {
    const category = categoryById.get(block.categoryId);
    return category ? groupByCategoryId.get(category.id) ?? otherGroup : otherGroup;
  };
  const dayCount = getCalendarDayCount(start, end);

  return Array.from({ length: dayCount }, (_, index) => {
    const dayStart = addCalendarDays(start, index);
    const dayEnd = addCalendarDays(dayStart, 1);
    const dayStartMs = getBoundaryInstant(dayStart, timeZone).getTime();
    const dayEndMs = getBoundaryInstant(dayEnd, timeZone).getTime();
    const minutesByGroup = new Map<string, number>();

    selectedBlocks.forEach((block) => {
      const minutes = getOverlappingMinutesForInstants(block, dayStartMs, dayEndMs);

      if (minutes <= 0) {
        return;
      }

      const group = getGroupForBlock(block);
      minutesByGroup.set(group.id, (minutesByGroup.get(group.id) ?? 0) + minutes);
    });

    const segments = groupDefinitions
      .map<DailyGroupHoursSegment>((group) => ({
        groupId: group.id,
        groupName: group.name,
        color: group.color,
        hours: (minutesByGroup.get(group.id) ?? 0) / 60,
      }))
      .filter((segment) => segment.hours > 0);
    const hours = segments.reduce((total, segment) => total + segment.hours, 0);

    return {
      date: dayStart.toISOString(),
      label: dayCount > 31
        ? shortMonthFormatter.format(dayStart)
        : dayLabelFormatter.format(dayStart),
      hours,
      segments,
    };
  });
}

export function calculateWeeklyStatsGroupHours(
  timeBlocks: TimeBlock[],
  start: Date,
  end: Date,
  categories: Category[],
  statsGroups: StatsGroup[],
  timeMode: StatsTimeMode = "active",
  timeZone?: string,
): DailyGroupHoursDatum[] {
  const selectedBlocks = getTimeBlocksForTimeMode(timeBlocks, timeMode);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const sortedGroups = [...statsGroups].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );
  const otherGroup =
    sortedGroups.find((group) => group.name.toLowerCase() === "other") ??
    otherTimeGroupDefinition;
  const groupDefinitions = [
    ...sortedGroups.map((group) => ({
      id: group.id,
      name: group.name,
      color: group.color,
    })),
    ...(sortedGroups.some((group) => group.id === otherGroup.id)
      ? []
      : [otherGroup]),
  ];
  const groupByCategoryId = new Map<string, StatsGroup>();

  sortedGroups.forEach((group) => {
    group.categoryIds.forEach((categoryId) => {
      groupByCategoryId.set(categoryId, group);
    });
  });

  const getGroupForBlock = (block: TimeBlock) => {
    const category = categoryById.get(block.categoryId);
    return category ? groupByCategoryId.get(category.id) ?? otherGroup : otherGroup;
  };
  const weekCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (oneDayMs * 7)));

  return Array.from({ length: weekCount }, (_, index) => {
    const weekStart = addCalendarDays(start, index * 7);
    const weekEnd = new Date(Math.min(addCalendarDays(weekStart, 7).getTime(), end.getTime()));
    const weekStartMs = getBoundaryInstant(weekStart, timeZone).getTime();
    const weekEndMs = getBoundaryInstant(weekEnd, timeZone).getTime();
    const minutesByGroup = new Map<string, number>();

    selectedBlocks.forEach((block) => {
      const minutes = getOverlappingMinutesForInstants(block, weekStartMs, weekEndMs);

      if (minutes <= 0) {
        return;
      }

      const group = getGroupForBlock(block);
      minutesByGroup.set(group.id, (minutesByGroup.get(group.id) ?? 0) + minutes);
    });

    const segments = groupDefinitions
      .map<DailyGroupHoursSegment>((group) => ({
        groupId: group.id,
        groupName: group.name,
        color: group.color,
        hours: (minutesByGroup.get(group.id) ?? 0) / 60,
      }))
      .filter((segment) => segment.hours > 0);
    const hours = segments.reduce((total, segment) => total + segment.hours, 0);

    return {
      date: weekStart.toISOString(),
      label: `Wk ${index + 1}`,
      hours,
      segments,
    };
  });
}

export function calculateMonthlyStatsGroupHours(
  timeBlocks: TimeBlock[],
  year: number,
  categories: Category[],
  statsGroups: StatsGroup[],
  timeMode: StatsTimeMode = "active",
  timeZone?: string,
): DailyGroupHoursDatum[] {
  const selectedBlocks = getTimeBlocksForTimeMode(timeBlocks, timeMode);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const sortedGroups = [...statsGroups].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );
  const otherGroup =
    sortedGroups.find((group) => group.name.toLowerCase() === "other") ??
    otherTimeGroupDefinition;
  const groupDefinitions = [
    ...sortedGroups.map((group) => ({
      id: group.id,
      name: group.name,
      color: group.color,
    })),
    ...(sortedGroups.some((group) => group.id === otherGroup.id)
      ? []
      : [otherGroup]),
  ];
  const groupByCategoryId = new Map<string, StatsGroup>();

  sortedGroups.forEach((group) => {
    group.categoryIds.forEach((categoryId) => {
      groupByCategoryId.set(categoryId, group);
    });
  });

  const getGroupForBlock = (block: TimeBlock) => {
    const category = categoryById.get(block.categoryId);
    return category ? groupByCategoryId.get(category.id) ?? otherGroup : otherGroup;
  };

  return Array.from({ length: 12 }, (_, month) => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 1);
    const monthStartMs = getBoundaryInstant(monthStart, timeZone).getTime();
    const monthEndMs = getBoundaryInstant(monthEnd, timeZone).getTime();
    const minutesByGroup = new Map<string, number>();

    selectedBlocks.forEach((block) => {
      const minutes = getOverlappingMinutesForInstants(block, monthStartMs, monthEndMs);

      if (minutes <= 0) {
        return;
      }

      const group = getGroupForBlock(block);
      minutesByGroup.set(group.id, (minutesByGroup.get(group.id) ?? 0) + minutes);
    });

    const segments = groupDefinitions
      .map<DailyGroupHoursSegment>((group) => ({
        groupId: group.id,
        groupName: group.name,
        color: group.color,
        hours: (minutesByGroup.get(group.id) ?? 0) / 60,
      }))
      .filter((segment) => segment.hours > 0);
    const hours = segments.reduce((total, segment) => total + segment.hours, 0);

    return {
      date: monthStart.toISOString(),
      label: shortMonthFormatter.format(monthStart),
      hours,
      segments,
    };
  });
}

export function calculateSleepStats(
  timeBlocks: TimeBlock[],
  categories: Category[],
  statsGroups: StatsGroup[],
  start: Date,
  end: Date,
  averagePolicy: SleepAveragePolicy = "logged-days",
  recordedDayCount?: number,
  currentDate = new Date(),
  timeZone?: string,
): SleepStats {
  const dayCount = getCalendarDayCount(start, end);
  const minutesByDay = Array.from({ length: dayCount }, () => 0);
  const rangeStartMs = getBoundaryInstant(start, timeZone).getTime();
  const rangeEndMs = getBoundaryInstant(end, timeZone).getTime();
  let totalMinutes = 0;

  timeBlocks
    .filter((block) => isActiveBlock(block) && !isAllDayBlock(block))
    .forEach((block) => {
      const { category, group } = getCategoryStatsGroup(
        block.categoryId,
        categories,
        statsGroups,
      );

      if (!isSleepStatsCategory(category, group)) {
        return;
      }

      const overlapMinutes = getOverlappingMinutesForInstants(
        block,
        rangeStartMs,
        rangeEndMs,
      );

      if (overlapMinutes <= 0) {
        return;
      }

      const overlapEnd = Math.min(
        new Date(block.endsAt).getTime(),
        rangeEndMs,
      );
      const attributionDate = timeZone
        ? toZonedCalendarDate(
            new Date(
              Math.max(
                overlapEnd - 1,
                rangeStartMs,
              ),
            ),
            timeZone,
          )
        : new Date(Math.max(overlapEnd - 1, start.getTime()));
      const dayIndex = getCalendarDayIndex(startOfDay(start), startOfDay(attributionDate));

      totalMinutes += overlapMinutes;

      if (dayIndex >= 0 && dayIndex < minutesByDay.length) {
        minutesByDay[dayIndex] += overlapMinutes;
      }
    });

  const dailyHours = minutesByDay.map<DailyHoursDatum>((minutes, index) => {
    const date = addCalendarDays(start, index);
    return {
      date: date.toISOString(),
      label: rhythmWeekdayFormatter.format(date),
      hours: minutes / 60,
    };
  });
  const loggedDays = dailyHours.filter((day) => day.hours > 0);
  const shortestDay = loggedDays.reduce<DailyHoursDatum | null>(
    (current, day) => (!current || day.hours < current.hours ? day : current),
    null,
  );
  const longestDay = loggedDays.reduce<DailyHoursDatum | null>(
    (current, day) => (!current || day.hours > current.hours ? day : current),
    null,
  );
  const averageDayCount = getSleepAverageDayCount(
    start,
    end,
    dayCount,
    loggedDays.length,
    averagePolicy,
    recordedDayCount,
    currentDate,
  );

  return {
    averageHoursPerDay:
      averageDayCount > 0 ? totalMinutes / 60 / averageDayCount : 0,
    averageDayCount,
    daysLogged: loggedDays.length,
    longestDay,
    shortestDay,
    totalHours: totalMinutes / 60,
  };
}

export function calculateDailySleepHours(
  timeBlocks: TimeBlock[],
  categories: Category[],
  statsGroups: StatsGroup[],
  start: Date,
  end: Date,
  timeZone?: string,
): DailyHoursDatum[] {
  const dayCount = getCalendarDayCount(start, end);
  const minutesByDay = Array.from({ length: dayCount }, () => 0);
  const rangeStartMs = getBoundaryInstant(start, timeZone).getTime();
  const rangeEndMs = getBoundaryInstant(end, timeZone).getTime();

  timeBlocks
    .filter((block) => isActiveBlock(block) && !isAllDayBlock(block))
    .forEach((block) => {
      const { category, group } = getCategoryStatsGroup(
        block.categoryId,
        categories,
        statsGroups,
      );

      if (!isSleepStatsCategory(category, group)) {
        return;
      }

      const overlapMinutes = getOverlappingMinutesForInstants(
        block,
        rangeStartMs,
        rangeEndMs,
      );

      if (overlapMinutes <= 0) {
        return;
      }

      const overlapEnd = Math.min(
        new Date(block.endsAt).getTime(),
        rangeEndMs,
      );
      const attributionDate = timeZone
        ? toZonedCalendarDate(
            new Date(
              Math.max(
                overlapEnd - 1,
                rangeStartMs,
              ),
            ),
            timeZone,
          )
        : new Date(Math.max(overlapEnd - 1, start.getTime()));
      const dayIndex = getCalendarDayIndex(startOfDay(start), startOfDay(attributionDate));

      if (dayIndex >= 0 && dayIndex < minutesByDay.length) {
        minutesByDay[dayIndex] += overlapMinutes;
      }
    });

  return minutesByDay.map<DailyHoursDatum>((minutes, index) => {
    const date = addCalendarDays(start, index);
    return {
      date: date.toISOString(),
      label: String(date.getDate()),
      hours: minutes / 60,
    };
  });
}

export function calculateMonthlyPlannedHours(
  timeBlocks: TimeBlock[],
  year: number,
  timeMode: StatsTimeMode = "active",
  timeZone?: string,
) {
  const selectedBlocks = getTimeBlocksForTimeMode(timeBlocks, timeMode);
  return Array.from({ length: 12 }, (_, month) => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    const startMs = getBoundaryInstant(start, timeZone).getTime();
    const endMs = getBoundaryInstant(end, timeZone).getTime();
    const minutes = selectedBlocks.reduce(
      (total, block) =>
        total + getOverlappingMinutesForInstants(block, startMs, endMs),
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
  timeZone?: string,
): TaskStatusStats {
  return {
    notStarted: tasks.filter((task) => task.status === "todo").length,
    inProgress: tasks.filter((task) => task.status === "in-progress").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    done: tasks.filter((task) => task.status === "done").length,
    canceled: tasks.filter((task) => task.status === "canceled").length,
    overdue: getOverdueTasks(tasks, referenceDate, timeZone).length,
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
  recordedDayCount?: number,
  timeZone?: string,
): StatsSummary {
  const categoryHours = calculateCategoryHours(timeBlocks, categories, timeMode);
  const dayCount =
    recordedDayCount ??
    getRecordedTimeBlockDayCount(timeBlocks, start, end, timeZone);
  const weekCount = dayCount / 7;
  const activeDailyHours = calculateDailyPlannedHours(
    timeBlocks,
    start,
    end,
    "active",
    timeZone,
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
    overdueTasks: getOverdueTasks(tasks, referenceDate, timeZone).length,
    timeBlocksCount: getTimeBlocksForTimeMode(timeBlocks, timeMode).length,
    averageSelectedHoursPerDay:
      dayCount > 0 ? selectedTimeHours / dayCount : 0,
    averageSelectedHoursPerWeek:
      weekCount > 0 ? selectedTimeHours / weekCount : 0,
    averagePlannedHoursPerDay:
      dayCount > 0 ? totalPlannedHours / dayCount : 0,
    averagePlannedHoursPerWeek:
      weekCount > 0 ? totalPlannedHours / weekCount : 0,
    mostActiveCategoryName:
      getTopCategoryHoursDatum(categoryHours)?.categoryName ?? null,
  };
}

export function buildYearHeatmapData(
  timeBlocks: TimeBlock[],
  categories: Category[],
  statsGroups: StatsGroup[],
  year: number,
  timeZone?: string,
) {
  const days: YearHeatmapDay[] = [];
  const date = new Date(year, 0, 1);

  while (date.getFullYear() === year) {
    const dayStart = startOfDay(date);
    const dayEnd = addCalendarDays(dayStart, 1);
    const dayBlocks = getBlocksForDay(timeBlocks, dayStart, timeZone);
    const trackedBlocks = dayBlocks.filter(
      (block) => isActiveBlock(block) && !isAllDayBlock(block),
    );
    const productiveBlocks = filterBlocksByStatsGroupProductiveTime(
      trackedBlocks,
      categories,
      statsGroups,
    );
    const abandonedBlocks = dayBlocks.filter(
      (block) => isAbandonedBlock(block) && !isAllDayBlock(block),
    );
    const categoryHours = calculateCategoryHours(trackedBlocks, categories);
    const timeGroupHours = calculateTimeGroupHours(
      trackedBlocks,
      categories,
      statsGroups,
    );
    const sleepStats = calculateSleepStats(
      trackedBlocks,
      categories,
      statsGroups,
      dayStart,
      dayEnd,
      "period-days",
      undefined,
      new Date(),
      timeZone,
    );

    days.push({
      date: dayStart.toISOString(),
      productiveHours: calculateActualHours(productiveBlocks),
      trackedHours: calculateActualHours(trackedBlocks),
      sleepHours: sleepStats.totalHours,
      abandonedHours: calculateSkippedHours(abandonedBlocks),
      focusHours: calculatePomodoroHours(trackedBlocks),
      timeBlocksCount: dayBlocks.length,
      topStatsGroupName:
        timeGroupHours.find((group) => group.hours > 0)?.name ?? null,
      topCategoryName:
        getTopCategoryHoursDatum(categoryHours)?.categoryName ?? null,
    });

    date.setDate(date.getDate() + 1);
  }

  return days;
}

const pressurePriorityWeights: Record<Task["priority"], number> = {
  high: 1.3,
  low: 0.75,
  medium: 1,
};
const examPressurePeakWeight = 2;

function parsePressureDueDate(value: string) {
  const trimmedValue = value.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    const date = new Date(year, month, day);

    return date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
      ? date
      : null;
  }

  const date = new Date(trimmedValue);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function getPressureDueWeight(dueDate: Date, dayStart: Date) {
  const dueDay = startOfDay(dueDate);
  const dueDayIndex = Date.UTC(
    dueDay.getFullYear(),
    dueDay.getMonth(),
    dueDay.getDate(),
  );
  const currentDayIndex = Date.UTC(
    dayStart.getFullYear(),
    dayStart.getMonth(),
    dayStart.getDate(),
  );
  const dayDistance = Math.abs((dueDayIndex - currentDayIndex) / oneDayMs);

  if (dayDistance === 0) {
    return 1;
  }

  if (dayDistance === 1) {
    return 0.7;
  }

  if (dayDistance === 2) {
    return 0.45;
  }

  if (dayDistance === 3) {
    return 0.25;
  }

  return 0;
}

function getExamPressureWeight(examDate: Date, dayStart: Date) {
  const examDay = startOfDay(examDate);
  const examDayIndex = Date.UTC(
    examDay.getFullYear(),
    examDay.getMonth(),
    examDay.getDate(),
  );
  const currentDayIndex = Date.UTC(
    dayStart.getFullYear(),
    dayStart.getMonth(),
    dayStart.getDate(),
  );
  const daysUntilExam = (examDayIndex - currentDayIndex) / oneDayMs;

  if (daysUntilExam === 0) {
    return 1;
  }

  if (daysUntilExam === 1) {
    return 0.7;
  }

  if (daysUntilExam === 2) {
    return 0.45;
  }

  if (daysUntilExam === 3) {
    return 0.25;
  }

  return 0;
}

function getPressureDatumFields(
  day: Omit<PressureDatum, "rawPressure" | "smoothedPressure">,
) {
  return {
    date: day.date,
    duePressure: day.duePressure,
    duePoints: day.duePoints,
    examMarkerColor: day.examMarkerColor,
    examPressure: day.examPressure,
    examsOnDayCount: day.examsOnDayCount,
    examsWithin3DaysCount: day.examsWithin3DaysCount,
    label: day.label,
    tasksDueWithin3DaysCount: day.tasksDueWithin3DaysCount,
    taskWorkHours: day.taskWorkHours,
    workPoints: day.workPoints,
  };
}

function getPressureTaskCoverageRange(
  task: Task,
  rangeStart: Date,
  rangeEnd: Date,
) {
  if (!task.dueDate || task.status === "canceled") {
    return null;
  }

  const dueDate = parsePressureDueDate(task.dueDate);
  if (!dueDate) {
    return null;
  }

  const taskCoverageStart = addCalendarDays(dueDate, -3);
  const taskCoverageEnd = addCalendarDays(dueDate, 3);
  const lastRangeDay = addCalendarDays(rangeEnd, -1);

  if (
    taskCoverageEnd.getTime() < rangeStart.getTime() ||
    taskCoverageStart.getTime() > lastRangeDay.getTime()
  ) {
    return null;
  }

  return {
    end: new Date(
      Math.min(taskCoverageEnd.getTime(), lastRangeDay.getTime()),
    ),
    start: new Date(
      Math.max(taskCoverageStart.getTime(), rangeStart.getTime()),
    ),
  };
}

function getPressureExamCoverageRange(
  examDate: Date,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const examCoverageStart = addCalendarDays(examDate, -3);
  const lastRangeDay = addCalendarDays(rangeEnd, -1);

  if (
    examDate.getTime() < rangeStart.getTime() ||
    examCoverageStart.getTime() > lastRangeDay.getTime()
  ) {
    return null;
  }

  return {
    end: new Date(Math.min(examDate.getTime(), lastRangeDay.getTime())),
    start: new Date(
      Math.max(examCoverageStart.getTime(), rangeStart.getTime()),
    ),
  };
}

function getPressureCoverageWindow(
  tasks: Task[],
  timeBlocks: TimeBlock[],
  examDates: Date[],
  rangeStart: Date,
  rangeEnd: Date,
  timeZone?: string,
) {
  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  const startInstant = getBoundaryInstant(start, timeZone).getTime();
  const endInstant = getBoundaryInstant(end, timeZone).getTime();
  const relevantTimes: number[] = [];
  const toCoverageDayTime = (instant: number) =>
    startOfDay(
      timeZone
        ? toZonedCalendarDate(new Date(instant), timeZone)
        : new Date(instant),
    ).getTime();

  timeBlocks.forEach((block) => {
    if (isAllDayBlock(block)) {
      return;
    }

    const startsAt = new Date(block.startsAt).getTime();
    const endsAt = new Date(block.endsAt).getTime();

    if (endsAt <= startInstant || startsAt >= endInstant) {
      return;
    }

    relevantTimes.push(toCoverageDayTime(Math.max(startsAt, startInstant)));
    relevantTimes.push(toCoverageDayTime(Math.min(endsAt - 1, endInstant - 1)));
  });

  tasks.forEach((task) => {
    const taskCoverageRange = getPressureTaskCoverageRange(task, start, end);

    if (taskCoverageRange) {
      relevantTimes.push(taskCoverageRange.start.getTime());
      relevantTimes.push(taskCoverageRange.end.getTime());
    }
  });

  examDates.forEach((examDate) => {
    const examCoverageRange = getPressureExamCoverageRange(
      examDate,
      start,
      end,
    );

    if (examCoverageRange) {
      relevantTimes.push(examCoverageRange.start.getTime());
      relevantTimes.push(examCoverageRange.end.getTime());
    }
  });

  if (relevantTimes.length === 0) {
    return null;
  }

  const coverageStart = startOfDay(new Date(Math.min(...relevantTimes)));
  const coverageEnd = startOfDay(new Date(Math.max(...relevantTimes)));

  if (coverageStart.getTime() > coverageEnd.getTime()) {
    return null;
  }

  return { end: coverageEnd, start: coverageStart };
}

export function calculatePressureLevel(
  tasks: Task[],
  timeBlocks: TimeBlock[],
  categories: Category[],
  start: Date,
  end: Date,
  smoothingDays = 3,
  timeZone?: string,
): PressureDatum[] {
  const rawDays: Array<
    Omit<PressureDatum, "rawPressure" | "smoothedPressure"> & {
      inCoverage: boolean;
    }
  > = [];
  const date = startOfDay(start);
  const rangeEnd = startOfDay(end);
  const examCategoryIds = new Set(
    categories
      .filter((category) => category.name.trim().toLowerCase() === "exam")
      .map((category) => category.id),
  );
  const examOccurrences = timeBlocks.flatMap((block) => {
    const category = categories.find(
      (currentCategory) => currentCategory.id === block.categoryId,
    );
    if (
      !isActiveBlock(block) ||
      !category ||
      !examCategoryIds.has(category.id)
    ) {
      return [];
    }

    const examDate = startOfDay(
      timeZone
        ? toZonedCalendarDate(block.startsAt, timeZone)
        : new Date(block.startsAt),
    );
    return Number.isNaN(examDate.getTime())
      ? []
      : [
          {
            date: examDate,
            markerColor: getCategoryColorValues(category.color).accent,
          },
        ];
  });
  const coverageWindow = getPressureCoverageWindow(
    tasks,
    timeBlocks,
    examOccurrences.map((exam) => exam.date),
    date,
    rangeEnd,
    timeZone,
  );
  const pressureTasks = tasks.flatMap((task) => {
    if (!task.dueDate || task.status === "canceled") {
      return [];
    }

    const dueDate = parsePressureDueDate(task.dueDate);
    return dueDate ? [{ dueDate, priority: task.priority }] : [];
  });
  const pressureBlocks = timeBlocks.filter(
    (block) =>
      isActiveBlock(block) &&
      !isAllDayBlock(block) &&
      (Boolean(block.taskId) ||
        block.kind === "task-session" ||
        block.source === "pomodoro" ||
        block.source === "timer"),
  );
  const dueRef = 4;
  const workRef = 6;

  while (date.getTime() < rangeEnd.getTime()) {
    const dayStart = startOfDay(date);
    const dayEnd = addCalendarDays(dayStart, 1);
    const dayStartMs = getBoundaryInstant(dayStart, timeZone).getTime();
    const dayEndMs = getBoundaryInstant(dayEnd, timeZone).getTime();
    const inCoverage = Boolean(
      coverageWindow &&
        dayStart.getTime() >= coverageWindow.start.getTime() &&
        dayStart.getTime() <= coverageWindow.end.getTime(),
    );
    const duePressure = inCoverage ? pressureTasks.reduce((total, task) => {
      const dueWeight = getPressureDueWeight(task.dueDate, dayStart);
      return (
        total +
        dueWeight * pressurePriorityWeights[task.priority]
      );
    }, 0) : 0;
    const tasksDueWithin3DaysCount = inCoverage ? pressureTasks.filter((task) => {
      return getPressureDueWeight(task.dueDate, dayStart) > 0;
    }).length : 0;
    const examPressure = inCoverage ? examOccurrences.reduce((total, exam) => {
      return total + getExamPressureWeight(exam.date, dayStart) * examPressurePeakWeight;
    }, 0) : 0;
    const examsWithin3DaysCount = inCoverage ? examOccurrences.filter((exam) => {
      return getExamPressureWeight(exam.date, dayStart) > 0;
    }).length : 0;
    const examsOnDay = inCoverage ? examOccurrences.filter((exam) => {
      return isSameCalendarDay(exam.date, dayStart);
    }) : [];
    const taskWorkHours = inCoverage
      ?
      pressureBlocks.reduce(
        (total, block) =>
          total + getOverlappingMinutesForInstants(block, dayStartMs, dayEndMs),
        0,
      ) / 60
      : 0;
    const duePoints = 55 * ((duePressure + examPressure) / dueRef);
    const workPoints = 45 * (taskWorkHours / workRef);

    rawDays.push({
      date: dayStart.toISOString(),
      duePressure,
      duePoints,
      examMarkerColor: examsOnDay[0]?.markerColor ?? null,
      examPressure,
      examsOnDayCount: examsOnDay.length,
      examsWithin3DaysCount,
      inCoverage,
      label: dayLabelFormatter.format(dayStart),
      tasksDueWithin3DaysCount,
      taskWorkHours,
      workPoints,
    });

    date.setDate(date.getDate() + 1);
  }

  const scoredDays = rawDays.map((day) => {
    if (!day.inCoverage) {
      return {
        ...getPressureDatumFields(day),
        rawPressure: null,
      };
    }

    return {
      ...getPressureDatumFields(day),
      rawPressure: day.duePoints + day.workPoints,
    };
  });

  return scoredDays.map((day, index) => {
    if (day.rawPressure === null) {
      return {
        ...day,
        smoothedPressure: null,
      };
    }

    const leadingDays = Math.floor(smoothingDays / 2);
    const trailingDays = Math.max(0, smoothingDays - leadingDays - 1);
    const windowDays = [day];

    for (let offset = 1; offset <= leadingDays; offset += 1) {
      const previousDay = scoredDays[index - offset];

      if (!previousDay || previousDay.rawPressure === null) {
        break;
      }

      windowDays.unshift(previousDay);
    }

    for (let offset = 1; offset <= trailingDays; offset += 1) {
      const nextDay = scoredDays[index + offset];

      if (!nextDay || nextDay.rawPressure === null) {
        break;
      }

      windowDays.push(nextDay);
    }

    const smoothedPressure =
      windowDays.reduce(
        (total, currentDay) => total + (currentDay.rawPressure ?? 0),
        0,
      ) / windowDays.length;

    return {
      ...day,
      smoothedPressure,
    };
  });
}

export function calculateYearPressureLevel(
  tasks: Task[],
  timeBlocks: TimeBlock[],
  categories: Category[],
  year: number,
  timeZone?: string,
): PressureDatum[] {
  return calculatePressureLevel(
    tasks,
    timeBlocks,
    categories,
    new Date(year, 0, 1),
    new Date(year + 1, 0, 1),
    7,
    timeZone,
  );
}

export function getHeatmapValue(
  day: YearHeatmapDay,
  metric: StatsHeatmapMetric,
) {
  if (metric === "productive_hours") {
    return day.productiveHours;
  }

  if (metric === "tracked_hours") {
    return day.trackedHours;
  }

  if (metric === "sleep_hours") {
    return day.sleepHours;
  }

  if (metric === "abandoned_hours") {
    return day.abandonedHours;
  }

  if (metric === "focus_hours") {
    return day.focusHours;
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
