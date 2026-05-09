export type NavItemId =
  | "calendar"
  | "tasks"
  | "pomodoro"
  | "stats"
  | "categories"
  | "settings";

export type CalendarView = "week" | "month";

export type StatsRange = "week" | "month" | "year";

export type StatsTimeMode = "active";

export type StatsAnalyzeBy = "category" | "kind" | "outcome" | "source";

export type StatsBlockKindFilter =
  | "all"
  | "event"
  | "task-session"
  | "habit"
  | "routine";

export type StatsBlockOutcomeFilter =
  | "all"
  | "active"
  | "abandoned";

export type StatsBlockSourceFilter =
  | "all"
  | "manual"
  | "pomodoro"
  | "generated"
  | "imported";

export type StatsHeatmapMetric =
  | "productive_hours"
  | "tracked_hours"
  | "sleep_hours"
  | "abandoned_hours"
  | "focus_hours"
  | "time_blocks_count";

export type StatsFilters = {
  analyzeBy: StatsAnalyzeBy;
  categoryId: string;
  blockKind: StatsBlockKindFilter;
  blockOutcome: StatsBlockOutcomeFilter;
  blockSource: StatsBlockSourceFilter;
  heatmapMetric: StatsHeatmapMetric;
  range: StatsRange;
  selectedDateIso: string;
  timeMode: StatsTimeMode;
  includeCompletedTasks: boolean;
  includeAllDayBlocks: boolean;
  includeUncategorized: boolean;
  includeStatsExcludedCategories: boolean;
  showAllTrackedTime: boolean;
  refreshKey: number;
};

export type WeekStartDay = "sunday" | "monday";

export type AppSettings = {
  weekStartDay: WeekStartDay;
  visibleStartHour: number;
  visibleEndHour: number;
  compactTodo: boolean;
};
