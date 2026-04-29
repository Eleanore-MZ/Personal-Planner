export type NavItemId =
  | "calendar"
  | "tasks"
  | "stats"
  | "categories"
  | "settings";

export type CalendarView = "week" | "month" | "year";

export type WeekStartDay = "sunday" | "monday";

export type AppSettings = {
  weekStartDay: WeekStartDay;
  visibleStartHour: number;
  visibleEndHour: number;
  compactTodo: boolean;
};
