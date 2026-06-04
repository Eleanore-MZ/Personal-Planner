import { DateTime, IANAZone } from "luxon";

export const maxCalendarTimeZones = 4;
export const systemTimeZone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export type AmbiguousTimeChoice = "earlier" | "later";

export type ZonedDateTimeResolution =
  | { status: "valid"; date: Date }
  | { status: "ambiguous"; earlier: Date; later: Date }
  | { status: "invalid"; message: string };

const pad = (value: number) => `${value}`.padStart(2, "0");
const zonedDayBoundaryCache = new Map<string, number>();
const maxZonedDayBoundaryCacheSize = 4096;

export function isValidTimeZone(timeZone: string) {
  return IANAZone.isValidZone(timeZone);
}

export function normalizeCalendarTimeZones(
  timeZones: string[] | undefined,
  primaryTimeZone?: string,
) {
  const validZones = [...new Set([...(timeZones ?? []), primaryTimeZone])]
    .filter((timeZone): timeZone is string => Boolean(timeZone))
    .filter(isValidTimeZone)
    .slice(0, maxCalendarTimeZones);
  const zones = validZones.length > 0 ? validZones : [systemTimeZone];
  const primary =
    primaryTimeZone && zones.includes(primaryTimeZone)
      ? primaryTimeZone
      : zones[0];

  return { calendarTimeZones: zones, primaryCalendarTimeZone: primary };
}

export function getTimeZoneLabel(timeZone: string) {
  return timeZone.split("/").at(-1)?.replace(/_/g, " ") ?? timeZone;
}

export function formatTimeZoneNow(timeZone: string) {
  return DateTime.now().setZone(timeZone).toFormat("HH:mm ZZZZ");
}

export function getZonedDateParts(date: string | Date, timeZone: string) {
  const zonedDate = DateTime.fromJSDate(new Date(date)).setZone(timeZone);
  return {
    year: zonedDate.year,
    month: zonedDate.month,
    day: zonedDate.day,
    hour: zonedDate.hour,
    minute: zonedDate.minute,
    second: zonedDate.second,
    millisecond: zonedDate.millisecond,
  };
}

export function toZonedCalendarDate(date: string | Date, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone);
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
}

export function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

export function toTimeInputValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getZonedDateInputValue(date: string | Date, timeZone: string) {
  return toDateInputValue(toZonedCalendarDate(date, timeZone));
}

export function getZonedTimeInputValue(date: string | Date, timeZone: string) {
  return toTimeInputValue(toZonedCalendarDate(date, timeZone));
}

function hasRequestedWallTime(
  dateTime: DateTime,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  return (
    dateTime.year === year &&
    dateTime.month === month &&
    dateTime.day === day &&
    dateTime.hour === hour &&
    dateTime.minute === minute
  );
}

export function resolveZonedDateTime(
  dateValue: string,
  timeValue: string,
  timeZone: string,
  ambiguousChoice?: AmbiguousTimeChoice,
): ZonedDateTimeResolution {
  if (!isValidTimeZone(timeZone)) {
    return { status: "invalid", message: "Choose a valid timezone." };
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!dateMatch || !timeMatch) {
    return { status: "invalid", message: "Enter a valid date and time." };
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const dateTime = DateTime.fromObject(
    { year, month, day, hour, minute },
    { zone: timeZone },
  );

  if (
    !dateTime.isValid ||
    !hasRequestedWallTime(dateTime, year, month, day, hour, minute)
  ) {
    return {
      status: "invalid",
      message: "This local time does not exist because of a DST transition.",
    };
  }

  const possibleDates = dateTime
    .getPossibleOffsets()
    .filter((candidate) =>
      hasRequestedWallTime(candidate, year, month, day, hour, minute),
    )
    .sort((first, second) => first.toMillis() - second.toMillis());

  if (possibleDates.length > 1) {
    const earlier = possibleDates[0].toJSDate();
    const later = possibleDates[possibleDates.length - 1].toJSDate();
    if (!ambiguousChoice) {
      return { status: "ambiguous", earlier, later };
    }
    return {
      status: "valid",
      date: ambiguousChoice === "later" ? later : earlier,
    };
  }

  return { status: "valid", date: dateTime.toJSDate() };
}

export function resolveCalendarDate(
  calendarDate: Date,
  timeZone: string,
  ambiguousChoice?: AmbiguousTimeChoice,
) {
  return resolveZonedDateTime(
    toDateInputValue(calendarDate),
    toTimeInputValue(calendarDate),
    timeZone,
    ambiguousChoice,
  );
}

export function resolveCalendarMinute(
  calendarDay: Date,
  minuteOfDay: number,
  timeZone: string,
  ambiguousChoice?: AmbiguousTimeChoice,
) {
  const calendarDate = new Date(calendarDay);
  calendarDate.setHours(0, minuteOfDay, 0, 0);
  return resolveCalendarDate(calendarDate, timeZone, ambiguousChoice);
}

export function getZonedDayBoundary(calendarDay: Date, timeZone: string) {
  const boundary = new Date(calendarDay);
  boundary.setHours(0, 0, 0, 0);
  const cacheKey = `${timeZone}:${toDateInputValue(boundary)}`;
  const cachedBoundary = zonedDayBoundaryCache.get(cacheKey);
  if (cachedBoundary !== undefined) {
    return new Date(cachedBoundary);
  }

  const resolution = resolveCalendarDate(boundary, timeZone);
  const resolvedBoundary =
    resolution.status === "valid"
      ? resolution.date
      : DateTime.fromObject(
          {
            year: boundary.getFullYear(),
            month: boundary.getMonth() + 1,
            day: boundary.getDate(),
          },
          { zone: timeZone },
        )
          .startOf("day")
          .toJSDate();

  if (zonedDayBoundaryCache.size >= maxZonedDayBoundaryCacheSize) {
    zonedDayBoundaryCache.clear();
  }
  zonedDayBoundaryCache.set(cacheKey, resolvedBoundary.getTime());
  return new Date(resolvedBoundary);
}

export function formatInTimeZone(
  date: string | Date,
  timeZone: string,
  format: string,
) {
  return DateTime.fromJSDate(new Date(date)).setZone(timeZone).toFormat(format);
}

export function getTimeZoneOffsetMinutes(
  date: string | Date,
  timeZone: string,
) {
  return DateTime.fromJSDate(new Date(date)).setZone(timeZone).offset;
}
