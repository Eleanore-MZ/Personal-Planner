import type { CalendarView, NavItemId } from "../types/app";

export const navItems: Array<{ id: NavItemId; label: string }> = [
  { id: "calendar", label: "Calendar" },
  { id: "tasks", label: "Tasks" },
  { id: "stats", label: "Stats" },
  { id: "categories", label: "Categories" },
];

export const calendarViews: Array<{ id: CalendarView; label: string }> = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];
