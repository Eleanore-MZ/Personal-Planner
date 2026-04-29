const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function formatDate(date: string | Date) {
  return dateFormatter.format(new Date(date));
}

export function formatTime(date: string | Date) {
  return timeFormatter.format(new Date(date));
}

export function formatDateTimeRange(startsAt: string, endsAt: string) {
  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  if (startDate.toDateString() === endDate.toDateString()) {
    return `${dayFormatter.format(startDate)}, ${formatTime(startsAt)} - ${formatTime(endsAt)}`;
  }

  return `${dayFormatter.format(startDate)}, ${formatTime(startsAt)} - ${dayFormatter.format(endDate)}, ${formatTime(endsAt)}`;
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
