const dateFormatOptions: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

const timeFormatOptions: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

const dayFormatOptions: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

export function formatDate(date: string | Date, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    ...dateFormatOptions,
    timeZone,
  }).format(new Date(date));
}

export function formatTime(date: string | Date, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    ...timeFormatOptions,
    timeZone,
  }).format(new Date(date));
}

export function formatDateTimeRange(
  startsAt: string,
  endsAt: string,
  timeZone?: string,
) {
  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    ...dayFormatOptions,
    timeZone,
  });
  const startDay = dayFormatter.format(startDate);
  const endDay = dayFormatter.format(endDate);
  if (startDay === endDay) {
    return `${startDay}, ${formatTime(startsAt, timeZone)} - ${formatTime(endsAt, timeZone)}`;
  }

  return `${startDay}, ${formatTime(startsAt, timeZone)} - ${endDay}, ${formatTime(endsAt, timeZone)}`;
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function atTime(date: Date, hour: number, minute = 0) {
  const nextDate = new Date(date);
  nextDate.setHours(hour, minute, 0, 0);
  return nextDate;
}
