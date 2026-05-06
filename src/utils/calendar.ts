import type { TimeBlock } from "../types/domain";

export const calendarStartHour = 6;
export const calendarEndHour = 22;
export const calendarHourHeight = 72;

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const dateTitleFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const monthTitleFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

export const categoryColorValues = {
  cyan: {
    accent: "#22d3ee",
    background: "rgba(34, 211, 238, 0.18)",
    border: "rgba(34, 211, 238, 0.48)",
  },
  blue: {
    accent: "#60a5fa",
    background: "rgba(96, 165, 250, 0.18)",
    border: "rgba(96, 165, 250, 0.46)",
  },
  green: {
    accent: "#34d399",
    background: "rgba(52, 211, 153, 0.16)",
    border: "rgba(52, 211, 153, 0.44)",
  },
  yellow: {
    accent: "#facc15",
    background: "rgba(250, 204, 21, 0.16)",
    border: "rgba(250, 204, 21, 0.42)",
  },
  orange: {
    accent: "#fb923c",
    background: "rgba(251, 146, 60, 0.17)",
    border: "rgba(251, 146, 60, 0.44)",
  },
  pink: {
    accent: "#f472b6",
    background: "rgba(244, 114, 182, 0.16)",
    border: "rgba(244, 114, 182, 0.42)",
  },
  purple: {
    accent: "#a78bfa",
    background: "rgba(167, 139, 250, 0.17)",
    border: "rgba(167, 139, 250, 0.43)",
  },
};

type CategoryColorStyle = {
  accent: string;
  background: string;
  border: string;
};

const fallbackCategoryColor = categoryColorValues.cyan;

function normalizeHexColor(color: string) {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }

  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, red, green, blue] = color;
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }

  return undefined;
}

function hexToRgb(color: string) {
  const normalized = normalizeHexColor(color);
  if (!normalized) {
    return undefined;
  }

  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function getCategoryAccentColor(color: string) {
  const presetColor =
    categoryColorValues[color as keyof typeof categoryColorValues];
  return presetColor?.accent ?? normalizeHexColor(color) ?? fallbackCategoryColor.accent;
}

export function getCategoryColorValues(color?: string): CategoryColorStyle {
  if (!color) {
    return fallbackCategoryColor;
  }

  const presetColor =
    categoryColorValues[color as keyof typeof categoryColorValues];
  if (presetColor) {
    return presetColor;
  }

  const normalized = normalizeHexColor(color);
  const rgb = normalized ? hexToRgb(normalized) : undefined;
  if (!normalized || !rgb) {
    return fallbackCategoryColor;
  }

  return {
    accent: normalized,
    background: `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, 0.18)`,
    border: `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, 0.48)`,
  };
}

export function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

export function startOfWeek(date: Date, weekStartDay: "sunday" | "monday" = "monday") {
  const nextDate = startOfDay(date);
  const offset =
    weekStartDay === "monday" ? (nextDate.getDay() + 6) % 7 : nextDate.getDay();
  nextDate.setDate(nextDate.getDate() - offset);
  return nextDate;
}

export function addCalendarDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function addCalendarMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  const day = nextDate.getDate();
  nextDate.setDate(1);
  nextDate.setMonth(nextDate.getMonth() + months);
  const lastDayOfMonth = new Date(
    nextDate.getFullYear(),
    nextDate.getMonth() + 1,
    0,
  ).getDate();
  nextDate.setDate(Math.min(day, lastDayOfMonth));
  return nextDate;
}

export function getWeekDays(date: Date, weekStartDay: "sunday" | "monday" = "monday") {
  const weekStart = startOfWeek(date, weekStartDay);
  return Array.from({ length: 7 }, (_, index) =>
    addCalendarDays(weekStart, index),
  );
}

export function isSameCalendarDay(firstDate: Date, secondDate: Date) {
  return startOfDay(firstDate).getTime() === startOfDay(secondDate).getTime();
}

export function isAllDayBlock(block: TimeBlock) {
  return Boolean(block.isAllDay);
}

export function getAllDayEndDate(block: TimeBlock) {
  const startsAt = startOfDay(new Date(block.startsAt));
  const endsAt = startOfDay(new Date(block.endsAt));
  return endsAt <= startsAt ? addCalendarDays(startsAt, 1) : endsAt;
}

export function doesBlockOverlapDay(block: TimeBlock, date: Date) {
  const dayStart = startOfDay(date);
  const nextDay = addCalendarDays(dayStart, 1);
  const startsAt = isAllDayBlock(block)
    ? startOfDay(new Date(block.startsAt))
    : new Date(block.startsAt);
  const endsAt = isAllDayBlock(block)
    ? getAllDayEndDate(block)
    : new Date(block.endsAt);
  return endsAt > dayStart && startsAt < nextDay;
}

export function getBlocksForDay(blocks: TimeBlock[], date: Date) {
  const dayStart = startOfDay(date);
  const nextDay = addCalendarDays(dayStart, 1);

  return blocks.flatMap((block) => {
    if (isAllDayBlock(block)) {
      return doesBlockOverlapDay(block, date) ? [block] : [];
    }

    const startsAt = new Date(block.startsAt);
    const endsAt = new Date(block.endsAt);
    if (endsAt <= dayStart || startsAt >= nextDay) {
      return [];
    }

    return [
      {
        ...block,
        startsAt: new Date(
          Math.max(startsAt.getTime(), dayStart.getTime()),
        ).toISOString(),
        endsAt: new Date(
          Math.min(endsAt.getTime(), nextDay.getTime()),
        ).toISOString(),
      },
    ];
  });
}

export function getTimeBlockSeriesId(block: TimeBlock) {
  return block.recurringTimeBlockId ?? block.id;
}

export function formatRecurrenceLabel(block: TimeBlock) {
  const frequency = block.recurrenceFrequency ?? "none";
  if (frequency === "none") {
    return "Does not repeat";
  }

  const interval = Math.max(1, block.recurrenceInterval ?? 1);
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const label =
    frequency === "daily"
      ? interval === 1
        ? "Daily"
        : `Every ${interval} days`
      : frequency === "weekly"
        ? `${interval === 1 ? "Weekly" : `Every ${interval} weeks`}${
            block.recurrenceWeekdays?.length
              ? ` on ${block.recurrenceWeekdays
                  .map((weekday) => weekdayLabels[weekday])
                  .join(", ")}`
              : ""
          }`
        : interval === 1
          ? "Monthly"
          : `Every ${interval} months`;

  if (block.recurrenceEndMode === "after" && block.recurrenceCount) {
    return `${label} for ${block.recurrenceCount} times`;
  }

  if (block.recurrenceEndMode !== "on" || !block.recurrenceEndDate) {
    return label;
  }

  return `${label} until ${dateTitleFormatter.format(
    new Date(block.recurrenceEndDate),
  )}`;
}

function getOccurrenceBlock(
  block: TimeBlock,
  occurrenceStart: Date,
  durationMs: number,
  index: number,
) {
  const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
  return {
    ...block,
    id:
      index === 0
        ? block.id
        : `${block.id}__${occurrenceStart.toISOString()}`,
    startsAt: occurrenceStart.toISOString(),
    endsAt: occurrenceEnd.toISOString(),
    recurringTimeBlockId: index === 0 ? undefined : block.id,
  };
}

function copyTimeToDate(source: Date, target: Date) {
  const nextDate = new Date(target);
  nextDate.setHours(
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds(),
  );
  return nextDate;
}

function getWeekIndexFromStart(startDate: Date, candidateDate: Date) {
  const startWeek = startOfWeek(startDate, "sunday").getTime();
  const candidateWeek = startOfWeek(candidateDate, "sunday").getTime();
  return Math.floor((candidateWeek - startWeek) / (7 * 24 * 60 * 60 * 1000));
}

export function expandRecurringTimeBlocks(
  blocks: TimeBlock[],
  rangeStart: Date,
  rangeEnd: Date,
) {
  const startTime = rangeStart.getTime();
  const endTime = rangeEnd.getTime();

  return blocks.flatMap((block) => {
    const frequency = block.recurrenceFrequency ?? "none";
    if (frequency === "none") {
      const blockStart = new Date(block.startsAt).getTime();
      const blockEnd = new Date(block.endsAt).getTime();
      return blockEnd >= startTime && blockStart <= endTime ? [block] : [];
    }

    const startsAt = new Date(block.startsAt);
    const endsAt = new Date(block.endsAt);
    const durationMs = endsAt.getTime() - startsAt.getTime();
    const interval = Math.max(1, block.recurrenceInterval ?? 1);
    const endMode =
      block.recurrenceEndMode === "never" && block.recurrenceEndDate
        ? "on"
        : block.recurrenceEndMode ??
          (block.recurrenceEndDate ? "on" : "never");
    const recurrenceEnd =
      endMode === "on" && block.recurrenceEndDate
        ? new Date(block.recurrenceEndDate)
        : rangeEnd;
    const recurrenceCount =
      endMode === "after" ? Math.max(1, block.recurrenceCount ?? 1) : undefined;
    const lastOccurrenceStart = new Date(
      Math.min(recurrenceEnd.getTime(), endTime),
    );
    const exceptionStarts = new Set(block.recurrenceExceptions ?? []);
    const occurrences: TimeBlock[] = [];
    let generatedCount = 0;

    const maybePushOccurrence = (occurrenceStart: Date) => {
      if (recurrenceCount && generatedCount >= recurrenceCount) {
        return false;
      }

      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      if (exceptionStarts.has(occurrenceStart.toISOString())) {
        generatedCount += 1;
        return true;
      }

      if (occurrenceEnd.getTime() >= startTime && occurrenceStart.getTime() <= endTime) {
        occurrences.push(
          getOccurrenceBlock(block, occurrenceStart, durationMs, generatedCount),
        );
      }
      generatedCount += 1;
      return true;
    };

    if (frequency === "weekly") {
      const weekdays =
        block.recurrenceWeekdays && block.recurrenceWeekdays.length > 0
          ? [...new Set(block.recurrenceWeekdays)].sort()
          : [startsAt.getDay()];
      let candidateDate = startOfDay(startsAt);
      let guard = 0;

      while (candidateDate <= lastOccurrenceStart && guard < 4000) {
        const weekIndex = getWeekIndexFromStart(startsAt, candidateDate);
        if (
          candidateDate >= startOfDay(startsAt) &&
          weekIndex >= 0 &&
          weekIndex % interval === 0 &&
          weekdays.includes(candidateDate.getDay())
        ) {
          const occurrenceStart = copyTimeToDate(startsAt, candidateDate);
          if (!maybePushOccurrence(occurrenceStart)) {
            break;
          }
        }

        candidateDate = addCalendarDays(candidateDate, 1);
        guard += 1;
      }
    } else {
      let occurrenceStart = new Date(startsAt);
      let guard = 0;

      while (occurrenceStart <= lastOccurrenceStart && guard < 2000) {
        if (!maybePushOccurrence(occurrenceStart)) {
          break;
        }

        if (frequency === "daily") {
          occurrenceStart = addCalendarDays(occurrenceStart, interval);
        } else {
          occurrenceStart = addCalendarMonths(occurrenceStart, interval);
        }
        guard += 1;
      }
    }

    return occurrences;
  });
}

export function getBlockPosition(
  block: TimeBlock,
  startHour = calendarStartHour,
) {
  const startsAt = new Date(block.startsAt);
  const endsAt = new Date(block.endsAt);
  const startMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
  const endMinutes =
    endsAt.getHours() * 60 +
    endsAt.getMinutes() +
    (isSameCalendarDay(startsAt, endsAt) ? 0 : 24 * 60);
  const calendarStartMinutes = startHour * 60;
  const top =
    ((startMinutes - calendarStartMinutes) / 60) * calendarHourHeight;
  const height = Math.max(
    ((endMinutes - startMinutes) / 60) * calendarHourHeight,
    (15 / 60) * calendarHourHeight,
  );

  return {
    top,
    height,
  };
}

export function formatDayLabel(date: Date) {
  return dayLabelFormatter.format(date);
}

export function formatCalendarTitle(date: Date, view: string) {
  if (view === "week") {
    const weekDays = getWeekDays(date);
    const firstDay = weekDays[0];
    const lastDay = weekDays[6];
    return `${dateTitleFormatter.format(firstDay)} - ${dateTitleFormatter.format(lastDay)}`;
  }

  return monthTitleFormatter.format(date);
}

export function getCalendarHours(
  startHour = calendarStartHour,
  endHour = calendarEndHour,
) {
  return Array.from(
    { length: endHour - startHour + 1 },
    (_, index) => startHour + index,
  );
}

export function formatHour(hour: number) {
  return `${`${hour}`.padStart(2, "0")}:00`;
}
